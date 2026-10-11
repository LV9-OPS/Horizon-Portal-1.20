from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from datetime import datetime
from .database import Base
import uuid

class Creator(Base):
    __tablename__ = "creators"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    image_url = Column(String(500), default="")
    download_url = Column(String(500), default="")

class Download(Base):
    __tablename__ = "downloads"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    file_url = Column(String(500), default="")
    version = Column(String(50), default="1.0.0")

class Theme(Base):
    __tablename__ = "themes"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    preview_url = Column(String(500), default="")
    unlock_type = Column(String(100), default="free")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)
    donation_cents = Column(Integer, default=0, nullable=False)
    creator_badge = Column(Integer, default=0, nullable=False)
    beta_access = Column(Integer, default=0, nullable=False)
    discord_id = Column(String(32), unique=True, index=True, nullable=True)
    discord_username = Column(String(255), default="", nullable=False)
    auth_id = Column(String(36), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    auth_version = Column(Integer, default=1, nullable=False)

class OAuthTransaction(Base):
    __tablename__ = "oauth_transactions"
    id = Column(Integer, primary_key=True, index=True)
    state_hash = Column(String(64), unique=True, index=True, nullable=False)
    mode = Column(String(20), nullable=False)
    browser_nonce = Column(String(64), nullable=False)
    code_verifier = Column(String(128), nullable=False)
    launcher_code_challenge = Column(String(128), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)

class LauncherAuthCode(Base):
    __tablename__ = "launcher_auth_codes"
    id = Column(Integer, primary_key=True, index=True)
    code_hash = Column(String(64), unique=True, index=True, nullable=False)
    auth_id = Column(String(36), nullable=False, index=True)
    auth_version = Column(Integer, nullable=False)
    code_challenge = Column(String(128), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)

class Installation(Base):
    __tablename__ = "installations"
    id = Column(Integer, primary_key=True, index=True)
    installation_id = Column(String(64), unique=True, index=True, nullable=False)
    credential_hash = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

class RedeemCode(Base):
    __tablename__ = "redeem_codes"
    id = Column(Integer, primary_key=True, index=True)
    code_hash = Column(String(64), unique=True, index=True, nullable=False)
    entitlement = Column(String(100), nullable=False, default="beta")
    status = Column(String(20), nullable=False, default="active", index=True)
    redeemed_by_auth_id = Column(String(36), nullable=True, index=True)
    redeemed_by_installation_id = Column(String(64), nullable=True, index=True)
    redeemed_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Entitlement(Base):
    __tablename__ = "entitlements"
    id = Column(Integer, primary_key=True, index=True)
    subject_type = Column(String(20), nullable=False, index=True)
    subject_id = Column(String(64), nullable=False, index=True)
    entitlement = Column(String(100), nullable=False, index=True)
    source = Column(String(50), nullable=False)
    source_id = Column(String(64), nullable=True, index=True)
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

class AuditEvent(Base):
    __tablename__ = "audit_events"
    id = Column(Integer, primary_key=True, index=True)
    actor_type = Column(String(30), nullable=False)
    actor_id = Column(String(64), nullable=True, index=True)
    action = Column(String(80), nullable=False, index=True)
    object_type = Column(String(50), nullable=True)
    object_id = Column(String(64), nullable=True, index=True)
    result = Column(String(30), nullable=False, default="success")
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class ModUploadRequest(Base):
    __tablename__ = "mod_upload_requests"
    id = Column(Integer, primary_key=True, index=True)
    installation_id = Column(String(64), nullable=True, index=True)
    auth_id = Column(String(36), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    game = Column(String(50), nullable=False)
    description = Column(Text, default="")
    file_name = Column(String(255), default="")
    file_size = Column(Integer, default=0)
    sha256 = Column(String(64), nullable=True, index=True)
    quarantine_path = Column(String(500), nullable=True)
    public_path = Column(String(500), nullable=True)
    public_url = Column(String(1000), nullable=True)
    status = Column(String(50), default="pending_review", nullable=False, index=True)
    moderation_reason = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(36), nullable=True)
    slug = Column(String(120), nullable=True, index=True)
    version = Column(String(50), default="1.0.0", nullable=False)
    changelog = Column(Text, default="")
    creator_name = Column(String(255), nullable=True)
    category = Column(String(100), nullable=True)
    github_url = Column(String(1000), nullable=True)
    github_readme_url = Column(String(1000), nullable=True)
    github_release_url = Column(String(1000), nullable=True)
