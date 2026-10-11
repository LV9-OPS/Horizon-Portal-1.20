import hashlib
import os
import secrets
import shutil
import subprocess
import zipfile
from pathlib import Path, PurePosixPath
from fastapi import HTTPException, UploadFile

MAX_UPLOAD = 512 * 1024 * 1024
MAX_UNCOMPRESSED = 2 * 1024 * 1024 * 1024
MAX_FILES = 10000
BLOCKED_EXTENSIONS = {".exe", ".dll", ".sys", ".msi", ".bat", ".cmd", ".com", ".scr", ".ps1", ".psm1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".hta", ".php", ".asp", ".aspx", ".jsp", ".cgi", ".sh", ".bash"}


def quarantine_root() -> Path:
    configured = os.getenv("WORKSHOP_QUARANTINE_DIR", "").strip()
    if not configured:
        if os.getenv("VERCEL") or os.getenv("HORIZON_ENV", "").lower() == "production":
            raise HTTPException(status_code=503, detail="Workshop storage is not configured for production.")
        configured = str(Path(__file__).resolve().parent.parent / "storage" / "quarantine")
    root = Path(configured).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def validate_filename(name: str) -> str:
    safe = Path(name or "").name
    if not safe or len(safe) > 120 or safe != name or any(ch in safe for ch in "\x00:/\\") or safe.startswith("."):
        raise HTTPException(status_code=400, detail="Unsafe upload filename.")
    if Path(safe).suffix.lower() != ".zip":
        raise HTTPException(status_code=415, detail="Only ZIP workshop packages are accepted.")
    return safe


def validate_zip(path: Path) -> tuple[int, int]:
    total = 0
    count = 0
    with zipfile.ZipFile(path, "r") as archive:
        bad = archive.testzip()
        if bad:
            raise HTTPException(status_code=422, detail="Corrupted ZIP package.")
        for info in archive.infolist():
            count += 1
            if count > MAX_FILES:
                raise HTTPException(status_code=422, detail="ZIP contains too many entries.")
            raw = info.filename.replace("\\", "/")
            pure = PurePosixPath(raw)
            if pure.is_absolute() or ".." in pure.parts or ":" in raw or raw.startswith("/"):
                raise HTTPException(status_code=422, detail="ZIP contains an unsafe path.")
            if info.is_dir():
                continue
            ext = Path(raw).suffix.lower()
            if ext in BLOCKED_EXTENSIONS:
                raise HTTPException(status_code=422, detail=f"Blocked file type in package: {ext}")
            total += max(0, info.file_size)
            if total > MAX_UNCOMPRESSED:
                raise HTTPException(status_code=422, detail="ZIP uncompressed size exceeds the safety limit.")
            if info.compress_size and info.file_size / max(info.compress_size, 1) > 1000:
                raise HTTPException(status_code=422, detail="ZIP compression ratio is unsafe.")
    return count, total


async def store_upload(file: UploadFile) -> tuple[Path, int, str]:
    original = validate_filename(file.filename or "")
    root = quarantine_root()
    stored = root / (secrets.token_hex(24) + ".zip")
    size = 0
    digest = hashlib.sha256()
    try:
        with stored.open("wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD:
                    raise HTTPException(status_code=413, detail="Upload exceeds the 512 MiB limit.")
                digest.update(chunk)
                handle.write(chunk)
        validate_zip(stored)
        return stored, size, digest.hexdigest()
    except Exception:
        stored.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


def run_optional_antivirus(path: Path) -> tuple[bool, str]:
    scanner = os.getenv("CLAMSCAN_PATH", "").strip()
    if not scanner:
        return False, "antivirus_not_configured"
    try:
        result = subprocess.run([scanner, "--no-summary", str(path)], capture_output=True, text=True, timeout=120, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return False, "antivirus_unavailable"
    if result.returncode == 0:
        return True, "clean"
    return False, "malware_or_scan_failure"
