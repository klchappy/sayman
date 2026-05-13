"""Görev template tag'leri — domain detay sayfaları için."""
from django import template

from apps.finance.permissions import can_write
from apps.tasks.services import get_tasks_for_object

register = template.Library()


@register.inclusion_tag("tasks/_object_tasks_panel.html", takes_context=True)
def related_tasks_panel(context, obj):
    """Bir domain instance için bağlı görev paneli render eder."""
    user = context["request"].user if "request" in context else None
    return {
        "obj": obj,
        "obj_app": obj._meta.app_label,
        "obj_model": obj._meta.model_name,
        "obj_title": str(obj)[:200],
        "can_create_task": can_write(user) if user else False,
        "related_tasks": get_tasks_for_object(obj, include_terminal=False),
    }
