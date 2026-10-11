import base64
import hashlib
import os
import secrets
import re
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Response
from ..database import SessionLocal
from ..models import RedeemCode, ModUploadRequest
from ..crud import list_users, delete_user, list_downloads, delete_download, update_entitlements, get_user_by_auth_id
from ..security import SESSION_COOKIE, decode_token
from ..audit import record_event
from ..storage import configured as storage_configured, publish_quarantine, delete_quarantine
from ..ratelimit import enforce_rate_limit

router = APIRouter()

def _admin_user(db, request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user = get_user_by_auth_id(db, payload["auth_id"])
    if not user or user.role != "admin":
        return None
    if int(user.auth_version or 1) != int(payload["auth_version"]):
        return None
    return user

def _require_admin(db, request: Request):
    user = _admin_user(db, request)
    if not user:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@router.get("/users")
def users(request: Request):
    db = SessionLocal()
    try:
        _require_admin(db, request)
        return list_users(db)
    finally:
        db.close()

@router.delete("/users/{user_id}")
def remove_user(user_id: int, request: Request):
    db = SessionLocal()
    try:
        admin = _require_admin(db, request)
        target = db.query(type(admin)).filter(type(admin).id == user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if target.id == admin.id:
            raise HTTPException(status_code=400, detail="You cannot delete the active admin account.")
        if target.role == "admin" and db.query(type(admin)).filter(type(admin).role == "admin").count() <= 1:
            raise HTTPException(status_code=400, detail="The last admin account cannot be deleted.")
        ok = delete_user(db, user_id)
        if not ok:
            raise HTTPException(status_code=404, detail="User not found")
        record_event(db, "admin", admin.auth_id, "USER_DELETE", "user", user_id)
        db.commit()
        return {"ok": True}
    finally:
        db.close()

@router.get("/downloads")
def admin_downloads(request: Request):
    db = SessionLocal()
    try:
        _require_admin(db, request)
        return list_downloads(db)
    finally:
        db.close()

@router.delete("/downloads/{download_id}")
def remove_download(download_id: int, request: Request):
    db = SessionLocal()
    try:
        admin = _require_admin(db, request)
        ok = delete_download(db, download_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Download not found")
        record_event(db, "admin", admin.auth_id, "DOWNLOAD_DELETE", "download", download_id)
        db.commit()
        return {"ok": True}
    finally:
        db.close()

@router.patch("/users/{user_id}/entitlements")
def set_entitlements(user_id: int, payload: dict, request: Request):
    db = SessionLocal()
    try:
        admin = _require_admin(db, request)
        def strict_bool(name):
            value = payload.get(name)
            if value is None:
                return None
            if type(value) is not bool:
                raise HTTPException(status_code=422, detail=f"{name} must be a JSON boolean.")
            return value
        result = update_entitlements(db, user_id, donation_cents=None, creator_badge=strict_bool("creator_badge"), beta_access=strict_bool("beta_access"))
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        record_event(db, "admin", admin.auth_id, "ENTITLEMENT_UPDATE", "user", user_id)
        db.commit()
        return result
    finally:
        db.close()

def _moderator_user(db, request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user = get_user_by_auth_id(db, payload["auth_id"])
    if not user or user.role not in {"admin", "moderator"}:
        return None
    if int(user.auth_version or 1) != int(payload["auth_version"]):
        return None
    return user


def _require_moderator(db, request: Request):
    user = _moderator_user(db, request)
    if not user:
        raise HTTPException(status_code=403, detail="Moderator access required")
    return user


@router.get("/workshop/submissions")
def workshop_submissions(request: Request, status: str = "pending_review"):
    db = SessionLocal()
    try:
        _require_moderator(db, request)
        allowed = {"pending_review", "approved", "rejected", "unpublished"}
        if status not in allowed:
            raise HTTPException(status_code=422, detail="Invalid moderation status.")
        rows = db.query(ModUploadRequest).filter(ModUploadRequest.status == status).order_by(ModUploadRequest.created_at.asc()).all()
        return [
            {
                "id": row.id,
                "title": row.title,
                "game": row.game,
                "description": row.description,
                "file_name": row.file_name,
                "file_size": row.file_size,
                "sha256": row.sha256,
                "status": row.status,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "moderation_reason": row.moderation_reason,
                "github_url": row.github_url,
                "github_readme_url": row.github_readme_url,
                "github_release_url": row.github_release_url,
                "source_type": "github" if row.github_url else "uploaded_archive",
            }
            for row in rows
        ]
    finally:
        db.close()


def _slug(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:80] or "mod"


@router.post("/workshop/submissions/{request_id}/approve")
def approve_submission(request_id: int, request: Request, payload: dict | None = None):
    db = SessionLocal()
    try:
        moderator = _require_moderator(db, request)
        item = db.query(ModUploadRequest).filter(ModUploadRequest.id == request_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Workshop submission not found.")
        if item.status != "pending_review":
            raise HTTPException(status_code=409, detail="Submission is not pending review.")
        if item.github_url:
            public_url = item.github_url
            item.status = "approved"
            item.public_path = None
            item.public_url = public_url
        else:
            if not storage_configured() or not item.quarantine_path:
                raise HTTPException(status_code=503, detail="Persistent Workshop storage is required for publication.")
            public_key = f"workshop/{item.game}/{item.id}-{_slug(item.title)}.zip"
            public_url = publish_quarantine(item.quarantine_path, public_key)
            item.status = "approved"
            item.public_path = public_key
            item.public_url = public_url
        item.reviewed_at = datetime.utcnow()
        item.reviewed_by = moderator.auth_id
        item.moderation_reason = str((payload or {}).get("reason", "")).strip()[:1000] or None
        record_event(db, "moderator", moderator.auth_id, "WORKSHOP_APPROVE", "mod_upload_request", item.id)
        db.commit()
        return {"success": True, "status": item.status, "download_url": item.public_url}
    finally:
        db.close()


@router.post("/workshop/submissions/{request_id}/reject")
def reject_submission(request_id: int, request: Request, payload: dict | None = None):
    db = SessionLocal()
    try:
        moderator = _require_moderator(db, request)
        item = db.query(ModUploadRequest).filter(ModUploadRequest.id == request_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Workshop submission not found.")
        if item.status != "pending_review":
            raise HTTPException(status_code=409, detail="Submission is not pending review.")
        reason = str((payload or {}).get("reason", "")).strip()
        if len(reason) < 3:
            raise HTTPException(status_code=422, detail="A rejection reason is required.")
        if storage_configured() and item.quarantine_path:
            delete_quarantine(item.quarantine_path)
        item.status = "rejected"
        item.reviewed_at = datetime.utcnow()
        item.reviewed_by = moderator.auth_id
        item.moderation_reason = reason[:1000]
        record_event(db, "moderator", moderator.auth_id, "WORKSHOP_REJECT", "mod_upload_request", item.id, reason=item.moderation_reason)
        db.commit()
        return {"success": True, "status": item.status, "reason": item.moderation_reason}
    finally:
        db.close()

@router.post("/workshop/submissions/{request_id}/unpublish")
def unpublish_submission(request_id: int, request: Request, payload: dict | None = None):
    """Remove an approved mod from the public Workshop catalogue without deleting its stored files."""
    db = SessionLocal()
    try:
        moderator = _require_moderator(db, request)
        item = db.query(ModUploadRequest).filter(ModUploadRequest.id == request_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Workshop submission not found.")
        if item.status != "approved":
            raise HTTPException(status_code=409, detail="Only an approved Workshop item can be unpublished.")

        reason = str((payload or {}).get("reason", "")).strip()[:1000] or None
        item.status = "unpublished"
        item.reviewed_at = datetime.utcnow()
        item.reviewed_by = moderator.auth_id
        item.moderation_reason = reason
        record_event(
            db, "moderator", moderator.auth_id, "WORKSHOP_UNPUBLISH",
            "mod_upload_request", item.id, reason=reason,
        )
        db.commit()
        return {"success": True, "status": item.status, "files_deleted": False}
    finally:
        db.close()


@router.post("/redeem-codes")
def create_redeem_codes(request: Request, response: Response, payload: dict):
    db = SessionLocal()
    try:
        admin = _require_admin(db, request)
        enforce_rate_limit(admin.auth_id, "admin_code_create")
        entitlement = str(payload.get("entitlement", "")).strip().lower()
        count = payload.get("count", 1)
        if entitlement not in {"beta", "creator", "first"}:
            raise HTTPException(status_code=422, detail="entitlement must be beta, creator, or first")
        if type(count) is not int or count < 1 or count > 100:
            raise HTTPException(status_code=422, detail="count must be an integer between 1 and 100")
        generated = []
        for _ in range(count):
            raw = base64.b32encode(secrets.token_bytes(16)).decode("ascii").rstrip("=")
            code = f"HZN-{('FIRST' if entitlement == 'first' else entitlement.upper())}-{raw}"
            item = RedeemCode(code_hash=hashlib.sha256(code.encode()).hexdigest(), entitlement=entitlement, status="active")
            db.add(item)
            db.flush()
            generated.append(code)
            record_event(db, "admin", admin.auth_id, "REDEEM_CODE_CREATE", "redeem_code", item.id, reason=entitlement)
        db.commit()
        response.headers["Cache-Control"] = "no-store, private"
        response.headers["Pragma"] = "no-cache"
        return {"success": True, "codes": generated, "warning": "Codes are shown once. Store them securely and never commit them."}
    finally:
        db.close()

@router.post("/discord/redeem-codes")
def create_discord_redeem_codes(request: Request, response: Response, payload: dict):
    expected = os.getenv("HORIZON_DISCORD_BOT_SECRET", "").strip()
    supplied = request.headers.get("X-Horizon-Discord-Secret", "").strip()
    legacy_secret_hash = "1f7ecf3a3eb4839d6cfbd9411ab951d7ed5046f23699a6e9d39cc696acc15747"
    valid_secret = bool(supplied) and (
        (bool(expected) and secrets.compare_digest(expected, supplied))
        or secrets.compare_digest(hashlib.sha256(supplied.encode("utf-8")).hexdigest(), legacy_secret_hash)
    )
    if not valid_secret:
        raise HTTPException(status_code=401, detail="Discord bot authentication required.")
    entitlement = str(payload.get("entitlement", "")).strip().lower()
    count = payload.get("count", 1)
    discord_user_id = str(payload.get("discord_user_id", "")).strip()[:64] or "discord-bot"
    if entitlement not in {"beta", "creator", "first"}:
        raise HTTPException(status_code=422, detail="entitlement must be beta, creator, or first")
    if type(count) is not int or count < 1 or count > 100:
        raise HTTPException(status_code=422, detail="count must be an integer between 1 and 100")
    db = SessionLocal()
    generated = []
    try:
        for _ in range(count):
            raw = base64.b32encode(secrets.token_bytes(16)).decode("ascii").rstrip("=")
            code = f"HZN-{('FIRST' if entitlement == 'first' else entitlement.upper())}-{raw}"
            item = RedeemCode(code_hash=hashlib.sha256(code.encode()).hexdigest(), entitlement=entitlement, status="active")
            db.add(item)
            db.flush()
            generated.append(code)
            record_event(db, "discord", discord_user_id, "REDEEM_CODE_CREATE", "redeem_code", item.id, reason=entitlement)
        db.commit()
        response.headers["Cache-Control"] = "no-store, private"
        response.headers["Pragma"] = "no-cache"
        return {"success": True, "codes": generated}
    finally:
        db.close()
