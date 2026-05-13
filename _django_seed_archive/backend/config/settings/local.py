"""
Local geliştirme settings — SQLite default.

UYARI: SQLite django-tenants ile schema-per-tenant pattern'i çalıştıramaz.
Bu settings sadece public schema'da single-tenant test için kullanılır.
Multi-tenant özelliklerini denemek için `config.settings.local_pg` kullanın.
"""
from .base import *  # noqa: F401,F403

DEBUG = True
# Subdomain testleri için *.localhost desteği
ALLOWED_HOSTS = [".localhost", "localhost", "127.0.0.1", "0.0.0.0"]

# SQLite default base.py'da tanımlı (django.db.backends.sqlite3).
# Multi-tenant runtime'a girilince base.py'da postgresql_backend zorunlu.

# Email — local console
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# CSRF/cookie güvenlik gevşek — sadece local
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
