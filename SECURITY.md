# Horizon Portal V1 security notes

## Production requirements

- DATABASE_URL is mandatory in production. SQLite is development-only.
- SECRET_KEY must be random, at least 32 characters, and never committed.
- Redeem codes are generated server-side and only their SHA-256 verifier is stored.
- Client installation IDs are identifiers, not proof of authorization.
- Protected launcher state and Creator operations require a server-issued installation credential.
- Creator uploads enter quarantine and are never published directly.
- Workshop packages are ZIP-only and validated for path traversal, excessive expansion, unsafe compression and executable/script payloads.
- If CLAMSCAN_PATH is configured, the package is scanned before review. Without an antivirus scanner, the package remains pending_review.
- Quarantine storage must be outside the webroot and persistent/private in production.
- Release artifacts must be signed and checksummed before publication.

## Redeem codes

V1 codes use 128 bits of randomness and are shown only at creation time. Existing 0.x seeded codes are not part of the V1 seed process and must be retired in any migrated production database.
