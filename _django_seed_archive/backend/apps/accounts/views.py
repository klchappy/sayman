from django.contrib.auth import views as auth_views
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.views.generic import TemplateView

from apps.audit.services import audit_log


class LoginView(auth_views.LoginView):
    template_name = "accounts/login.html"
    redirect_authenticated_user = True

    def form_valid(self, form):
        response = super().form_valid(form)
        audit_log(
            actor=form.get_user(),
            action="LOGIN",
            summary=f"Giriş: {form.get_user().username}",
            request=self.request,
        )
        return response


class LogoutView(auth_views.LogoutView):
    next_page = reverse_lazy("accounts:login")
    http_method_names = ["get", "post"]

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            audit_log(
                actor=request.user,
                action="LOGOUT",
                summary=f"Çıkış: {request.user.username}",
                request=request,
            )
        return super().dispatch(request, *args, **kwargs)


class ProfileView(LoginRequiredMixin, TemplateView):
    template_name = "accounts/profile.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["roles"] = list(self.request.user.groups.values_list("name", flat=True))
        return ctx
