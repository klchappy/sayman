"""Custom template tag/filter — TR para format ve badge helper."""
from django import template

from apps.core.helpers import format_money_tr

register = template.Library()


@register.filter
def money_tr(value):
    return format_money_tr(value)


@register.filter
def getattr_(obj, attr):
    """Generic field accessor for templates."""
    try:
        val = getattr(obj, attr, "")
        if callable(val):
            val = val()
        return val
    except Exception:
        return ""


@register.simple_tag
def status_badge(label, variant="info"):
    """
    Status badge HTML — DESIGN_STATUS_BADGE_SYSTEM.md ile uyumlu.
    Variants: success / warning / orange / danger / info / neutral / purple
    """
    return template.loader.render_to_string(
        "includes/status_badge.html",
        {"label": label, "variant": variant},
    )
