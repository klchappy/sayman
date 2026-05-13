"""
Lokal PostgreSQL + Multi-Tenant settings — `DJANGO_SETTINGS_MODULE=config.settings.local_pg`.

django-tenants `postgresql_backend` kullanır; schema-per-tenant pattern bu
ortamda devreye girer.
"""
import os

from .local import *  # noqa: F401,F403

DATABASES = {
    "default": {
        # NOT: django.db.backends.postgresql DEĞİL — django-tenants kendi
        # backend'ini sunar (schema'lar arası izolasyon için).
        "ENGINE": "django_tenants.postgresql_backend",
        "NAME": os.environ.get("DB_NAME", "sayman_dev"),
        "USER": os.environ.get("DB_USER", "sayman_user"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "sayman_pass"),
        "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}

# Lokal dev — wildcard subdomain
ALLOWED_HOSTS = [".localhost", "127.0.0.1", "localhost"]
