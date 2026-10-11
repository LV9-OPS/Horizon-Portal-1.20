from fastapi import APIRouter, HTTPException, Request
from ..database import SessionLocal
from ..crud import login_user
from ..security import create_access_token
from ..ratelimit import enforce_rate_limit

router = APIRouter()


@router.post("/login")
def login(request: Request, payload: dict):
    # Kept only for legacy admin tooling. Normal users authenticate with Discord.
    enforce_rate_limit(request.client.host if request.client else "unknown", "admin_login")
    db = SessionLocal()
    try:
        user = login_user(db, payload)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return user
    finally:
        db.close()


@router.post("/register")
def register(payload: dict):
    raise HTTPException(
        status_code=410,
        detail="Public password registration is disabled. Use Discord authentication.",
    )
@router.post("/token")
def token(payload: dict):
    # Launcher bearer tokens must originate from the Discord OAuth flow so
    # password credentials can never bypass Discord membership/role checks.
    raise HTTPException(
        status_code=410,
        detail="Password launcher tokens are disabled. Authenticate through Discord.",
    )
