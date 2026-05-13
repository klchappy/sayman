"""Local geliştirme settings — SQLite default."""
from .base import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

# SQLite default base.py'da tanımlı.

# Email — local console
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# CSRF/cookie güvenlik gevşek — sadece local
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
