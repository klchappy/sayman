"""Lokal PostgreSQL settings — `DJANGO_SETTINGS_MODULE=config.settings.local_pg`."""
import os

from .local import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "muhasebe_dev"),
        "USER": os.environ.get("DB_USER", "muhasebe_user"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "muhasebe_pass"),
        "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}
