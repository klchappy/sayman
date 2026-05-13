"""Audit service helper."""
from __future__ import annotations

from typing import Any

from .models import AuditLog


def _get_request_meta(request):
    if request is None:
        return None, ""
    ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR"))
    if ip and "," in ip:
        ip = ip.split(",")[0].strip()
    ua = request.META.get("HTTP_USER_AGENT", "")[:255]
    return ip, ua


def audit_log(
    actor=None,
    action: str = "VIEW",
    obj: Any = None,
    summary: str = "",
    metadata: dict | None = None,
    request=None,
) -> AuditLog:
    """Tek satırlık audit yazıcı."""
    ip, ua = _get_request_meta(request)

    if obj is not None:
        meta = obj._meta
        app_label = meta.app_label
        model_name = meta.model_name
        object_id = str(getattr(obj, "pk", ""))
        object_repr = str(obj)[:255]
    else:
        app_label = model_name = object_id = object_repr = ""

    return AuditLog.objects.create(
        actor=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
        action=action,
        app_label=app_label,
        model_name=model_name,
        object_id=object_id,
        object_repr=object_repr,
        summary=summary[:255],
        metadata=metadata or {},
        ip_address=ip,
        user_agent=ua,
    )
