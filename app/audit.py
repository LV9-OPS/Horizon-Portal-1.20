from datetime import datetime
from .models import AuditEvent


def record_event(db, actor_type, actor_id, action, object_type=None, object_id=None, result="success", reason=None):
    db.add(AuditEvent(actor_type=actor_type, actor_id=str(actor_id) if actor_id else None, action=action, object_type=object_type, object_id=str(object_id) if object_id else None, result=result, reason=reason))
