import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = (os.getenv("DATABASE_URL", "").strip() or os.getenv("POSTGRES_URL", "").strip() or os.getenv("POSTGRES_PRISMA_URL", "").strip())
IS_PRODUCTION = bool(os.getenv("VERCEL")) or os.getenv("HORIZON_ENV", "").lower() == "production"

if IS_PRODUCTION and not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be configured in production. Temporary SQLite is disabled.")
if IS_PRODUCTION and DATABASE_URL.lower().startswith("sqlite"):
    raise RuntimeError("Production DATABASE_URL must point to a durable PostgreSQL-compatible database.")

if DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = DATABASE_URL
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = "postgresql+psycopg://" + SQLALCHEMY_DATABASE_URL[len("postgres://"):]
    elif SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
        SQLALCHEMY_DATABASE_URL = "postgresql+psycopg://" + SQLALCHEMY_DATABASE_URL[len("postgresql://"):]
    connect_args = {"sslmode": "require"}
    # Supabase transaction pooling (port 6543) does not support prepared
    # statements. Disable psycopg's automatic preparation for that mode.
    if ":6543/" in DATABASE_URL or ":6543?" in DATABASE_URL:
        connect_args["prepare_threshold"] = None
        # Vercel's Supabase integration can append its routing hint as `supa=...`.
        # psycopg does not understand that libpq option, so remove it from the URL.
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("&supa=base-pooler.x", "").replace("?supa=base-pooler.x&", "?").replace("?supa=base-pooler.x", "")
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_size=1,
        max_overflow=0,
    )
else:
    db_path = BASE_DIR / "horizon.db"
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path.as_posix()}"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
