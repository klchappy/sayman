from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import ListView

from .models import AuditLog


class AuditListView(LoginRequiredMixin, ListView):
    model = AuditLog
    template_name = "audit/list.html"
    context_object_name = "logs"
    paginate_by = 50
    queryset = AuditLog.objects.select_related("actor").all()
