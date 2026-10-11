from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import desc
from ..database import SessionLocal
from ..models import ModUploadRequest, Creator

router = APIRouter()
_CACHE: dict[str, tuple[float, object, str]] = {}
CACHE_TTL = 30


def _cached(key: str, builder):
    now = time.time()
    item = _CACHE.get(key)
    if item and now - item[0] < CACHE_TTL:
        return item[1], item[2]
    payload = builder()
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
    etag = '"' + hashlib.sha256(raw).hexdigest() + '"'
    _CACHE[key] = (now, payload, etag)
    return payload, etag


def _response(request: Request, payload: dict | list, etag: str):
    if request.headers.get("if-none-match") == etag:
        return JSONResponse(status_code=304, content=None, headers={"ETag": etag, "Cache-Control": f"public, max-age={CACHE_TTL}"})
    return JSONResponse(payload, headers={"ETag": etag, "Cache-Control": f"public, max-age={CACHE_TTL}"})


@router.get("/status")
def status():
    storage = all(os.getenv(k, "").strip() for k in (
        "S3_ENDPOINT_URL", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY",
        "S3_QUARANTINE_BUCKET", "S3_PUBLIC_BUCKET", "WORKSHOP_PUBLIC_BASE_URL"
    ))
    return {
        "service": "Horizon Portal API",
        "version": os.getenv("HORIZON_API_VERSION", "0.9.10"),
        "status": "operational",
        "services": {
            "api": "operational",
            "database": "configured",
            "workshop_storage": "operational" if storage else "not_configured",
            "workshop_publication": "available" if storage else "unavailable",
        },
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/updates/manager")
def manager_update():
    version = os.getenv("HORIZON_LATEST_VERSION", "1.0.0")
    url = os.getenv("HORIZON_LATEST_DOWNLOAD_URL", "").strip()
    sha256 = os.getenv("HORIZON_LATEST_SHA256", "").strip().lower()
    size = int(os.getenv("HORIZON_LATEST_SIZE", "0") or 0)
    return {
        "product": "Horizon Manager",
        "latest_version": version,
        "download_url": url,
        "sha256": sha256,
        "size": size,
        "platform": "windows-x64",
        "release_channel": os.getenv("HORIZON_RELEASE_CHANNEL", "preview"),
        "release_notes_url": os.getenv("HORIZON_RELEASE_NOTES_URL", "https://horizon-portal.xyz/download"),
    }


def _workshop_payload(search: str = "", game: str = "", sort: str = "newest", page: int = 1, limit: int = 24):
    page = max(1, min(page, 10000))
    limit = max(1, min(limit, 50))
    db = SessionLocal()
    try:
        query = db.query(ModUploadRequest).filter(ModUploadRequest.status == "approved")
        if game:
            query = query.filter(ModUploadRequest.game == game.lower())
        if search:
            needle = f"%{search.strip()[:80]}%"
            query = query.filter((ModUploadRequest.title.ilike(needle)) | (ModUploadRequest.description.ilike(needle)))
        if sort == "oldest":
            query = query.order_by(ModUploadRequest.reviewed_at.asc())
        else:
            query = query.order_by(desc(ModUploadRequest.reviewed_at))
        total = query.count()
        rows = query.offset((page - 1) * limit).limit(limit).all()
        items = []
        for row in rows:
            items.append({
                "id": row.id,
                "slug": row.slug or f"project-{row.id}",
                "title": row.title,
                "creator": row.creator_name or "Community Creator",
                "game": row.game,
                "category": row.category or "Community Mod",
                "description": row.description,
                "version": row.version or "1.0.0",
                "changelog": row.changelog or "",
                "file_name": row.file_name,
                "file_size": row.file_size,
                "sha256": row.sha256,
                "download_url": row.public_url,
                "published_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
                "source_type": "github" if row.github_url else "uploaded_archive",
                "github_url": row.github_url,
                "github_readme_url": row.github_readme_url,
                "github_release_url": row.github_release_url,
                "image_url": row.image_url,
            })
        return {"items": items, "page": page, "limit": limit, "total": total}
    finally:
        db.close()


@router.get("/workshop")
def workshop(request: Request, search: str = "", game: str = "", sort: str = "newest", page: int = 1, limit: int = 24):
    key = f"workshop:{search[:80]}:{game[:30]}:{sort}:{page}:{limit}"
    payload, etag = _cached(key, lambda: _workshop_payload(search, game, sort, page, limit))
    return _response(request, payload, etag)


@router.get("/workshop/{project_id}")
def workshop_project(project_id: int):
    db = SessionLocal()
    try:
        row = db.query(ModUploadRequest).filter(ModUploadRequest.id == project_id, ModUploadRequest.status == "approved").first()
        if not row:
            raise HTTPException(status_code=404, detail="Workshop project not found.")
        return {
            "id": row.id,
            "slug": row.slug or f"project-{row.id}",
            "title": row.title,
            "creator": row.creator_name or "Community Creator",
            "game": row.game,
            "category": row.category or "Community Mod",
            "description": row.description,
            "version": row.version or "1.0.0",
            "changelog": row.changelog or "",
            "file_name": row.file_name,
            "file_size": row.file_size,
            "sha256": row.sha256,
            "download_url": row.public_url,
            "published_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
            "source_type": "github" if row.github_url else "uploaded_archive",
            "github_url": row.github_url,
            "github_readme_url": row.github_readme_url,
            "github_release_url": row.github_release_url,
            "image_url": row.image_url,
        }
    finally:
        db.close()


@router.get("/workshop/{project_id}/versions")
def workshop_versions(project_id: int):
    db = SessionLocal()
    try:
        row = db.query(ModUploadRequest).filter(ModUploadRequest.id == project_id, ModUploadRequest.status == "approved").first()
        if not row:
            raise HTTPException(status_code=404, detail="Workshop project not found.")
        return {
            "project_id": row.id,
            "versions": [{
                "version": row.version or "1.0.0",
                "changelog": row.changelog or "",
                "sha256": row.sha256,
                "file_size": row.file_size,
                "published_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
                "download_url": row.public_url,
                "source_type": "github" if row.github_url else "uploaded_archive",
                "github_url": row.github_url,
                "github_readme_url": row.github_readme_url,
                "github_release_url": row.github_release_url,
                "image_url": row.image_url,
            }],
        }
    finally:
        db.close()


@router.get("/creators")
def creator_list(request: Request):
    db = SessionLocal()
    try:
        rows = db.query(Creator).order_by(Creator.name.asc()).all()
        payload = [{"id": row.id, "slug": row.slug, "name": row.name, "description": row.description, "image_url": row.image_url} for row in rows]
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        etag = '"' + hashlib.sha256(raw).hexdigest() + '"'
        return _response(request, payload, etag)
    finally:
        db.close()




