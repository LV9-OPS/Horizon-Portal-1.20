import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from ..database import SessionLocal
from ..crud import list_downloads, get_download_by_slug

router = APIRouter()

@router.get("/")
def downloads():
    db = SessionLocal()
    try:
        return list_downloads(db)
    finally:
        db.close()

@router.get("/{slug}/file")
def download_file(slug: str):
    if slug != "core-pack":
        raise HTTPException(status_code=404, detail="Not found")
    target = "https://github.com/LV9-OPS/Horizon-Portal-1.20/raw/refs/heads/main/Horizon%20Manager_1.2.0_x64-setup.exe"
    try:
        db = SessionLocal()
        try:
            db.execute(text("INSERT INTO audit_events (actor_type, actor_id, action, object_type, object_id, result, reason) VALUES ('web', NULL, 'download', 'manager', :slug, 'success', 'Manager download started')"), {"slug": slug})
            db.commit()
        finally:
            db.close()
    except Exception:
        # The installer must remain downloadable even if the audit database is temporarily unavailable.
        pass
    return RedirectResponse(target, status_code=302)


@router.get("/{slug}")
def download(slug: str):
    db = SessionLocal()
    try:
        item = get_download_by_slug(db, slug)
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        return item
    finally:
        db.close()