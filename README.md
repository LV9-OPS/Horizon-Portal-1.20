# Horizon Portal V1

Security-first backend for Horizon Manager and the Workshop.

V1 security hardening is in progress. This repository is intentionally separate from the 0.x repository.

Development uses the local FastAPI app. Production requires PostgreSQL via DATABASE_URL and a high-entropy SECRET_KEY.

## Web integration

The V1 app can serve the existing Horizon Portal UI and its API from the same origin. For a temporary split frontend/API deployment, set HORIZON_WEB_ORIGINS to exact browser origins. Do not use wildcard origins with authenticated browser flows.

PUBLIC_LAUNCHER_DOWNLOAD_URL keeps the existing 0.9.1 Windows installer reachable during the V1 migration; replace it when Horizon Manager V1.0 is released.
