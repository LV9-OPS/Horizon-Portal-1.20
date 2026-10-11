from collections import defaultdict, deque
from time import monotonic
from fastapi import HTTPException

_BUCKETS = defaultdict(deque)
_LIMITS = {
    "redeem": (5, 60),
    "login": (8, 60),
    "oauth": (10, 60),
    "creator": (10, 60),
    "guest_install": (5, 60),
    "workshop_vote": (30, 60),
    "admin_login": (5, 60),
    "admin_code_create": (10, 60),
}


def enforce_rate_limit(key: str, bucket: str) -> None:
    limit, window = _LIMITS.get(bucket, (30, 60))
    now = monotonic()
    q = _BUCKETS[f"{bucket}:{key}"]
    while q and now - q[0] >= window:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    q.append(now)
