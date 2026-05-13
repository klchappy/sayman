"""Chat template tag'leri — domain detay sayfaları için."""
from django import template

from apps.chat.services import get_threads_for_object
from apps.finance.permissions import can_write

register = template.Library()


@register.inclusion_tag("chat/_object_chat_panel.html", takes_context=True)
def related_chat_panel(context, obj):
    user = context["request"].user if "request" in context else None
    return {
        "obj": obj,
        "obj_app": obj._meta.app_label,
        "obj_model": obj._meta.model_name,
        "obj_title": str(obj)[:200],
        "can_open_chat": can_write(user) if user else False,
        "related_threads": get_threads_for_object(obj),
    }


@register.simple_tag(takes_context=True)
def chat_unread_count(context):
    from apps.chat.services import get_unread_count
    user = context["request"].user if "request" in context else None
    if not user or not getattr(user, "is_authenticated", False):
        return 0
    return get_unread_count(user=user)
