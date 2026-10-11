import hashlib
import json
import os
import re
import secrets
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from sqlalchemy import update
from ..database import SessionLocal
from ..models import RedeemCode, Installation, Entitlement, ModUploadRequest
from ..security import issue_installation_credential, hash_credential, valid_installation_id
from ..ratelimit import enforce_rate_limit
from ..audit import record_event
from ..workshop_security import store_upload, run_optional_antivirus
from ..storage import configured as storage_configured, upload_quarantine

router = APIRouter()
CODE_RE = re.compile(r"^HZN-(?:BETA|CREATOR|FIRST)-[A-Z2-9]{26}$")
ALLOWED_GAMES = {"destiny2", "dawn", "sunrise", "sundial"}


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _github_json(url: str):
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "Horizon-Portal/0.9.13"})
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise HTTPException(status_code=502, detail="GitHub validation failed.") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="GitHub validation failed.") from exc


def _validate_github_repository(raw_url: str) -> dict:
    parsed = urllib.parse.urlparse(raw_url.strip())
    if parsed.scheme != "https" or parsed.netloc.lower() != "github.com":
        raise HTTPException(status_code=400, detail="Only public github.com repositories are accepted.")
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) < 2 or any(part in {"..", "."} for part in parts[:2]):
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL.")
    owner, repo = parts[0], parts[1].removesuffix(".git")
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", owner) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", repo):
        raise HTTPException(status_code=400, detail="Invalid GitHub repository identifier.")
    api_base = f"https://api.github.com/repos/{urllib.parse.quote(owner)}/{urllib.parse.quote(repo)}"
    repository = _github_json(api_base)
    if not repository or repository.get("private"):
        raise HTTPException(status_code=404, detail="Public GitHub repository not found.")
    readme = _github_json(api_base + "/readme")
    if not readme:
        raise HTTPException(status_code=422, detail="A README.md is required for Workshop submissions.")
    releases = _github_json(api_base + "/releases/latest")
    return {
        "repository_url": repository.get("html_url") or f"https://github.com/{owner}/{repo}",
        "readme_url": readme.get("html_url") or f"https://github.com/{owner}/{repo}#readme",
        "release_url": (releases or {}).get("html_url") or repository.get("html_url") or f"https://github.com/{owner}/{repo}",
        "default_branch": repository.get("default_branch") or "main",
        "stars": int(repository.get("stargazers_count") or 0),
    }


def _installation_from_request(db, request: Request):
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Installation authentication required.")
    credential = authorization[7:].strip()
    if len(credential) < 40 or len(credential) > 100:
        raise HTTPException(status_code=401, detail="Invalid installation credential.")
    item = db.query(Installation).filter(Installation.credential_hash == hash_credential(credential), Installation.revoked_at.is_(None)).first()
    if not item:
        raise HTTPException(status_code=401, detail="Installation credential expired or revoked.")
    item.last_seen_at = datetime.utcnow()
    return item


def _state(db, installation_id: str) -> dict:
    rows = db.query(Entitlement).filter(Entitlement.subject_type == "installation", Entitlement.subject_id == installation_id, Entitlement.revoked_at.is_(None)).all()
    entitlements = {row.entitlement for row in rows}
    return {
        "authenticated": True,
        "username": "Guest",
        "installation_id": installation_id,
        "beta_access": "beta" in entitlements,
        "creator_badge": "creator" in entitlements,
        "first_access": "first" in entitlements,
        "first_light_access": "first" in entitlements,
        "entitlements": sorted(entitlements),
    }


@router.post("/redeem")
def redeem(request: Request, payload: dict):
    enforce_rate_limit(request.client.host if request.client else "unknown", "redeem")
    code = str(payload.get("code", "")).strip().upper()
    installation_id = str(payload.get("installation_id", "")).strip()
    if not CODE_RE.fullmatch(code):
        raise HTTPException(status_code=400, detail="Invalid redeem code format.")
    if not valid_installation_id(installation_id):
        raise HTTPException(status_code=400, detail="A valid installation identifier is required.")

    db = SessionLocal()
    try:
        installation = db.query(Installation).filter(Installation.installation_id == installation_id).first()
        if not installation:
            installation_id, credential = issue_installation_credential()
            installation = Installation(installation_id=installation_id, credential_hash=hash_credential(credential))
            db.add(installation)
            db.flush()
        else:
            if installation.revoked_at:
                raise HTTPException(status_code=403, detail="Installation is revoked.")
            credential = None

        code_hash = _hash(code)
        item = db.query(RedeemCode).filter(RedeemCode.code_hash == code_hash, RedeemCode.status == "active", RedeemCode.revoked_at.is_(None), RedeemCode.redeemed_at.is_(None)).first()
        if not item:
            record_event(db, "installation", installation.installation_id, "REDEEM_FAILED", "redeem_code", code_hash, "failure", "invalid_or_used")
            db.commit()
            raise HTTPException(status_code=404, detail="Invalid or unavailable redeem code.")

        result = db.execute(update(RedeemCode).where(RedeemCode.id == item.id, RedeemCode.status == "active", RedeemCode.redeemed_at.is_(None), RedeemCode.revoked_at.is_(None)).values(status="claimed", redeemed_by_installation_id=installation.installation_id, redeemed_at=datetime.utcnow()))
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(status_code=409, detail="Redeem code is no longer available.")

        if credential is None:
            # Successful redeem on an existing installation: rotate and return
            # a fresh credential so the launcher can recover from lost local
            # credential storage without changing its installation id.
            _, credential = issue_installation_credential()
            installation.credential_hash = hash_credential(credential)

        db.add(Entitlement(subject_type="installation", subject_id=installation.installation_id, entitlement=item.entitlement, source="redeem_code", source_id=str(item.id)))
        record_event(db, "installation", installation.installation_id, "REDEEM", "redeem_code", item.id)
        db.commit()
        state = _state(db, installation.installation_id)
        response = {"success": True, "message": f"{item.entitlement.title()} access unlocked.", "entitlement": item.entitlement, **state}
        if credential:
            response["installation_credential"] = credential
        return response
    finally:
        db.close()


@router.post("/guest")
def create_guest_installation(request: Request, payload: dict):
    """Create a free installation identity for public Workshop voting."""
    enforce_rate_limit(request.client.host if request.client else "unknown", "guest_install")
    installation_id = str(payload.get("installation_id", "")).strip()
    if not valid_installation_id(installation_id):
        raise HTTPException(status_code=400, detail="A valid installation identifier is required.")

    db = SessionLocal()
    try:
        if db.query(Installation).filter(Installation.installation_id == installation_id).first():
            raise HTTPException(status_code=409, detail="Installation already exists.")
        _, credential = issue_installation_credential()
        installation = Installation(installation_id=installation_id, credential_hash=hash_credential(credential))
        db.add(installation)
        db.commit()
        return {"success": True, "installation_id": installation_id, "installation_credential": credential}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Installation could not be created.") from exc
    finally:
        db.close()


@router.get("/state")
def state(request: Request):
    db = SessionLocal()
    try:
        installation = _installation_from_request(db, request)
        db.commit()
        return _state(db, installation.installation_id)
    finally:
        db.close()


@router.get("/workshop")
def workshop():
    db = SessionLocal()
    try:
        rows = db.query(ModUploadRequest).filter(ModUploadRequest.status == "approved").order_by(ModUploadRequest.reviewed_at.desc()).all()
        return {
            "items": [
                {
                    "id": row.id,
                    "title": row.title,
                    "game": row.game,
                    "description": row.description,
                    "file_name": row.file_name,
                    "file_size": row.file_size,
                    "sha256": row.sha256,
                    "download_url": row.public_url,
                    "published_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
                }
                for row in rows
            ]
        }
    finally:
        db.close()

@router.post("/mod-request")
def mod_request(request: Request, payload: dict):
    enforce_rate_limit(request.client.host if request.client else "unknown", "creator")
    db = SessionLocal()
    try:
        installation = _installation_from_request(db, request)
        title = str(payload.get("title", "")).strip()
        game = str(payload.get("game", "")).strip().lower()
        description = str(payload.get("description", "")).strip()
        file_name = str(payload.get("file_name", "")).strip()
        file_size_raw = payload.get("file_size", 0)
        try:
            file_size = int(file_size_raw)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="file_size must be an integer.")
        if not title or game not in ALLOWED_GAMES:
            raise HTTPException(status_code=400, detail="Creator request data is incomplete.")
        if len(title) > 255 or len(description) > 5000 or len(file_name) > 255:
            raise HTTPException(status_code=400, detail="One or more fields are too long.")
        if file_size < 0 or file_size > 2 * 1024 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Invalid file size.")
        creator = db.query(Entitlement).filter(Entitlement.subject_type == "installation", Entitlement.subject_id == installation.installation_id, Entitlement.entitlement == "creator", Entitlement.revoked_at.is_(None)).first()
        if not creator:
            raise HTTPException(status_code=403, detail="Creator access is required.")
        item = ModUploadRequest(installation_id=installation.installation_id, title=title, game=game, description=description, file_name=file_name, file_size=file_size, status="pending")
        db.add(item)
        db.flush()
        record_event(db, "installation", installation.installation_id, "CREATOR_REQUEST", "mod_upload_request", item.id)
        db.commit()
        return {"success": True, "request_id": item.id, "status": item.status}
    finally:
        db.close()

@router.post("/mod-github-submit")
def mod_github_submit(request: Request, payload: dict):
    enforce_rate_limit(request.client.host if request.client else "unknown", "creator")
    db = SessionLocal()
    try:
        installation = _installation_from_request(db, request)
        creator = db.query(Entitlement).filter(Entitlement.subject_type == "installation", Entitlement.subject_id == installation.installation_id, Entitlement.entitlement == "creator", Entitlement.revoked_at.is_(None)).first()
        if not creator:
            raise HTTPException(status_code=403, detail="Creator access is required.")
        title = str(payload.get("title", "")).strip()
        game = str(payload.get("game", "")).strip().lower()
        description = str(payload.get("description", "")).strip()
        version = str(payload.get("version", "1.0.0")).strip()
        changelog = str(payload.get("changelog", "")).strip()
        category = str(payload.get("category", "Community Mod")).strip()
        github_url = str(payload.get("github_url", "")).strip()
        if not title or len(title) > 255 or game not in ALLOWED_GAMES or len(description) > 5000 or len(version) > 50 or len(changelog) > 5000 or len(category) > 100:
            raise HTTPException(status_code=400, detail="Invalid Creator metadata.")
        if not re.fullmatch(r"[0-9A-Za-z][0-9A-Za-z._+-]{0,49}", version):
            raise HTTPException(status_code=400, detail="Invalid version format.")
        github = _validate_github_repository(github_url)
        slug_base = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()).strip("-")[:70] or "project"
        github_digest = _hash(github["repository_url"])[:8]
        slug = f"{slug_base}-github-{github_digest}"
        item = ModUploadRequest(
            installation_id=installation.installation_id,
            title=title,
            game=game,
            description=description,
            file_name="",
            file_size=0,
            sha256=None,
            quarantine_path=None,
            status="pending_review",
            slug=slug,
            version=version,
            changelog=changelog,
            creator_name="Community Creator",
            category=category,
            github_url=github["repository_url"],
            github_readme_url=github["readme_url"],
            github_release_url=github["release_url"],
            image_url=image_url or None,
        )
        db.add(item)
        db.flush()
        record_event(db, "installation", installation.installation_id, "GITHUB_SUBMISSION", "mod_upload_request", item.id)
        db.commit()
        return {"success": True, "request_id": item.id, "status": item.status, "github": github}
    finally:
        db.close()


@router.post("/mod-upload")
async def mod_upload(request: Request, file: UploadFile = File(...), title: str = Form(""), game: str = Form(""), description: str = Form(""), version: str = Form("1.0.0"), changelog: str = Form(""), category: str = Form("Community Mod")):
    enforce_rate_limit(request.client.host if request.client else "unknown", "creator")
    db = SessionLocal()
    try:
        installation = _installation_from_request(db, request)
        title = str(title).strip()
        game = str(game).strip().lower()
        description = str(description).strip()
        version = str(version).strip()
        changelog = str(changelog).strip()
        category = str(category).strip()
        if not title or len(title) > 255 or game not in ALLOWED_GAMES or len(description) > 5000 or len(version) > 50 or len(changelog) > 5000 or len(category) > 100:
            raise HTTPException(status_code=400, detail="Invalid Creator metadata.")
        if not re.fullmatch(r"[0-9A-Za-z][0-9A-Za-z._+-]{0,49}", version):
            raise HTTPException(status_code=400, detail="Invalid version format.")
        creator = db.query(Entitlement).filter(Entitlement.subject_type == "installation", Entitlement.subject_id == installation.installation_id, Entitlement.entitlement == "creator", Entitlement.revoked_at.is_(None)).first()
        if not creator:
            raise HTTPException(status_code=403, detail="Creator access is required.")
        stored, size, digest = await store_upload(file)
        clean, scan_status = run_optional_antivirus(stored)
        production = bool(os.getenv("VERCEL") or os.getenv("HORIZON_ENV", "").lower() == "production")
        if production and scan_status != "clean":
            stored.unlink(missing_ok=True)
            raise HTTPException(status_code=503, detail="Malware scanning is required before Workshop submissions can be accepted.")
        status = "pending_review" if clean or scan_status == "antivirus_not_configured" else "rejected"
        quarantine_key = None
        if status != "rejected":
            if storage_configured():
                quarantine_key = upload_quarantine(stored, f"quarantine/{installation.installation_id}/{digest}.zip")
                if os.getenv("VERCEL") or os.getenv("HORIZON_ENV", "").lower() == "production":
                    stored.unlink(missing_ok=True)
            elif os.getenv("VERCEL") or os.getenv("HORIZON_ENV", "").lower() == "production":
                stored.unlink(missing_ok=True)
                raise HTTPException(status_code=503, detail="Persistent Workshop storage is not configured.")
        slug_base = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()).strip("-")[:70] or "project"
        slug = f"{slug_base}-{digest[:8]}"
        item = ModUploadRequest(installation_id=installation.installation_id, title=title, game=game, description=description, file_name=file.filename or "package.zip", file_size=size, sha256=digest, quarantine_path=quarantine_key or str(stored), status=status, slug=slug, version=version, changelog=changelog, creator_name="Community Creator", category=category)
        db.add(item)
        db.flush()
        record_event(db, "installation", installation.installation_id, "UPLOAD_VALIDATED", "mod_upload_request", item.id, "success" if status != "rejected" else "failure", scan_status)
        db.commit()
        return {"success": status != "rejected", "request_id": item.id, "status": status, "sha256": digest, "file_size": size, "scan": scan_status}
    finally:
        db.close()
import secrets

@router.post("/discord/workshop/approve")
def discord_workshop_approve(request: Request, payload: dict):
    expected = os.getenv("HORIZON_DISCORD_BOT_SECRET", "").strip()
    supplied = request.headers.get("X-Horizon-Discord-Secret", "").strip()
    # Keep the existing bot credential usable while Vercel is provisioned without
    # copying the raw secret into the production environment.
    legacy_secret_hash = "1f7ecf3a3eb4839d6cfbd9411ab951d7ed5046f23699a6e9d39cc696acc15747"
    valid_secret = bool(supplied) and (
        (bool(expected) and secrets.compare_digest(expected, supplied))
        or secrets.compare_digest(_hash(supplied), legacy_secret_hash)
    )
    if not valid_secret:
        raise HTTPException(status_code=401, detail="Discord bot authentication required.")
    github_url = str(payload.get("github_url", "")).strip()
    game = str(payload.get("game", "")).strip().lower()
    moderator_id = str(payload.get("moderator_id", "")).strip()[:64]
    title = str(payload.get("title", "")).strip()
    description = str(payload.get("description", "")).strip()
    version = str(payload.get("version", "1.0.0")).strip()
    image_url = str(payload.get("image_url", "")).strip()
    if game not in ALLOWED_GAMES or not github_url or not moderator_id or not title:
        raise HTTPException(status_code=422, detail="Invalid Workshop publication data.")
    if len(title) > 255 or len(description) > 5000 or len(version) > 50 or len(image_url) > 2000:
        raise HTTPException(status_code=422, detail="Workshop metadata is too long.")
    if not re.fullmatch(r"[0-9A-Za-z][0-9A-Za-z._+-]{0,49}", version):
        raise HTTPException(status_code=422, detail="Invalid version format.")
    github = _validate_github_repository(github_url)
    db = SessionLocal()
    try:
        duplicate = db.query(ModUploadRequest).filter(
            ModUploadRequest.github_url == github["repository_url"],
            ModUploadRequest.status.in_(["pending_review", "approved"]),
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail=f"GitHub repository already registered as request #{duplicate.id}.")
        slug_base = re.sub(
            r"[^a-z0-9]+", "-",
            unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
        ).strip("-")[:70] or "project"
        slug = f"{slug_base}-github-{_hash(github['repository_url'])[:8]}"
        item = ModUploadRequest(
            installation_id=None, auth_id=None, title=title, game=game,
            description=description, file_name="", file_size=0, sha256=None,
            quarantine_path=None, public_path=None, public_url=github["repository_url"],
            status="approved", slug=slug, version=version,
            changelog="", creator_name="Community Creator", category="Community Mod",
            github_url=github["repository_url"],
            github_readme_url=github["readme_url"],
            github_release_url=github["release_url"],
            reviewed_at=datetime.utcnow(), reviewed_by=moderator_id,
            moderation_reason="Approved from Horizon Discord.",
        )
        db.add(item)
        db.flush()
        record_event(db, "discord", moderator_id, "WORKSHOP_DISCORD_APPROVE", "mod_upload_request", item.id)
        db.commit()
        return {
            "success": True, "request_id": item.id, "status": item.status,
            "title": item.title, "version": item.version, "game": item.game,
            "github": github, "slug": item.slug,
            "workshop_url": f"https://horizon-portal.xyz/workshop/{item.slug}",
        }
    finally:
        db.close()

@router.post("/discord/workshop/unpublish")
def discord_workshop_unpublish(request: Request, payload: dict):
    expected = os.getenv("HORIZON_DISCORD_BOT_SECRET", "").strip()
    supplied = request.headers.get("X-Horizon-Discord-Secret", "").strip()
    legacy_secret_hash = "1f7ecf3a3eb4839d6cfbd9411ab951d7ed5046f23699a6e9d39cc696acc15747"
    valid_secret = bool(supplied) and (
        (bool(expected) and secrets.compare_digest(expected, supplied))
        or secrets.compare_digest(_hash(supplied), legacy_secret_hash)
    )
    if not valid_secret:
        raise HTTPException(status_code=401, detail="Discord bot authentication required.")

    request_id = payload.get("request_id")
    if type(request_id) is not int or request_id < 1:
        raise HTTPException(status_code=422, detail="A valid Workshop request ID is required.")
    moderator_id = str(payload.get("moderator_id", "")).strip()[:64]
    if not re.fullmatch(r"\d{1,64}", moderator_id):
        raise HTTPException(status_code=422, detail="A valid Discord moderator ID is required.")
    reason = str(payload.get("reason", "")).strip()[:1000] or None

    db = SessionLocal()
    try:
        item = db.query(ModUploadRequest).filter(ModUploadRequest.id == request_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Workshop item not found.")
        if item.status != "approved":
            raise HTTPException(status_code=409, detail="Workshop item is not currently published.")

        item.status = "unpublished"
        item.reviewed_at = datetime.utcnow()
        item.reviewed_by = moderator_id
        item.moderation_reason = reason
        record_event(db, "discord", moderator_id, "WORKSHOP_DISCORD_UNPUBLISH", "mod_upload_request", item.id, reason=reason)
        db.commit()
        return {"success": True, "request_id": item.id, "title": item.title, "status": item.status, "files_deleted": False}
    finally:
        db.close()


@router.post("/discord/redeem-codes")
def discord_redeem_codes(request: Request, payload: dict):
    expected = os.getenv("HORIZON_DISCORD_BOT_SECRET", "").strip()
    supplied = request.headers.get("X-Horizon-Discord-Secret", "").strip()
    legacy_secret_hash = "1f7ecf3a3eb4839d6cfbd9411ab951d7ed5046f23699a6e9d39cc696acc15747"
    valid_secret = bool(supplied) and (
        (bool(expected) and secrets.compare_digest(expected, supplied))
        or secrets.compare_digest(_hash(supplied), legacy_secret_hash)
    )
    if not valid_secret:
        raise HTTPException(status_code=401, detail="Discord bot authentication required.")

    entitlement = str(payload.get("entitlement", "")).strip().lower()
    count = payload.get("count", 1)
    moderator_id = str(payload.get("moderator_id", "")).strip()[:64]
    if entitlement not in {"beta", "creator", "first"}:
        raise HTTPException(status_code=422, detail="entitlement must be beta, creator, or first")
    if type(count) is not int or count < 1 or count > 100:
        raise HTTPException(status_code=422, detail="count must be an integer between 1 and 100")
    if not re.fullmatch(r"\d{1,64}", moderator_id):
        raise HTTPException(status_code=422, detail="A valid Discord moderator ID is required.")

    import base64
    import hashlib
    import secrets as _secrets

    db = SessionLocal()
    generated = []
    try:
        for _ in range(count):
            raw = base64.b32encode(_secrets.token_bytes(16)).decode("ascii").rstrip("=")
            code = f"HZN-{('FIRST' if entitlement == 'first' else entitlement.upper())}-{raw}"
            item = RedeemCode(
                code_hash=hashlib.sha256(code.encode()).hexdigest(),
                entitlement=entitlement,
                status="active",
            )
            db.add(item)
            db.flush()
            generated.append(code)
            record_event(db, "discord", moderator_id, "REDEEM_CODE_CREATE", "redeem_code", item.id, reason=entitlement)
        db.commit()
        return {"success": True, "codes": generated}
    finally:
        db.close()


