"""Production settings — Faz 15 Production Hardening Patch ile sertleştirildi.

Kullanım:
  DJANGO_SETTINGS_MODULE=config.settings.production
  EnvironmentFile=/var/www/muhasebe-ops/.env

Tüm gizli/değişken değerler env üzerinden gelir. Bu dosya secret içermez.
"""
import os
from pathlib import Path

from .base import *  # noqa: F401,F403

# --- Genel ------------------------------------------------------------------
DEBUG = False

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "").split(",") if h.strip()]

# --- CSRF (Django 4+ HTTPS form POST için zorunlu) --------------------------
# Tercihen env'den; verilmezse ALLOWED_HOSTS'tan https:// schemeli olarak türet.
_csrf_env = [o.strip() for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
if _csrf_env:
    CSRF_TRUSTED_ORIGINS = _csrf_env
else:
    CSRF_TRUSTED_ORIGINS = [
        f"https://{h}" for h in ALLOWED_HOSTS
        if h and not h.startswith(".") and h not in {"localhost", "127.0.0.1", "0.0.0.0"}
    ]

# --- Database ---------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["DB_NAME"],
        "USER": os.environ["DB_USER"],
        "PASSWORD": os.environ["DB_PASSWORD"],
        "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}

# --- Güvenlik bayrakları ----------------------------------------------------
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Reverse proxy (nginx) HTTPS terminate ediyor — header forward eder.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SECURE_SSL_REDIRECT = os.environ.get("DJANGO_SECURE_SSL_REDIRECT", "1") == "1"

SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_SECURE_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "SAMEORIGIN"

# --- Path'ler — PRODUCTION_DEPLOYMENT_PLAN ile uyumlu -----------------------
# /var/www/muhasebe-ops/{static,media,private_media}
_DEPLOY_ROOT = Path(os.environ.get("DEPLOY_ROOT", "/var/www/muhasebe-ops"))

STATIC_ROOT = str(_DEPLOY_ROOT / "static")
MEDIA_ROOT = str(_DEPLOY_ROOT / "media")
PRIVATE_MEDIA_ROOT = Path(os.environ.get("PRIVATE_MEDIA_ROOT", str(_DEPLOY_ROOT / "private_media")))

# Reports export root (Faz 12) — özel dizin altında saklanır
REPORT_EXPORT_ROOT = PRIVATE_MEDIA_ROOT / "reports"

# --- Upload limitleri (Faz 14 W2) -------------------------------------------
# Import 100 MB tavanını destekler; Django global limiti uyumlandı.
DATA_UPLOAD_MAX_MEMORY_SIZE = 110 * 1024 * 1024     # 110 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024      # 25 MB üstü diske spool

# --- Logging (Faz 14 W3) ----------------------------------------------------
_LOG_DIR = Path(os.environ.get("DJANGO_LOG_DIR", "/var/log/muhasebe-ops"))
try:
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
except (PermissionError, OSError):
    # Test/dev import sırasında /var/log yazılamayabilir; sessizce konsola düş.
    _LOG_DIR = None

_handlers = ["console"]
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": _handlers, "level": "INFO"},
    "loggers": {
        "django": {"handlers": _handlers, "level": "INFO", "propagate": False},
        "muhasebe": {"handlers": _handlers, "level": "INFO", "propagate": False},
    },
}

if _LOG_DIR is not None:
    LOGGING["handlers"]["file"] = {
        "class": "logging.handlers.RotatingFileHandler",
        "filename": str(_LOG_DIR / "app.log"),
        "maxBytes": 10 * 1024 * 1024,    # 10 MB
        "backupCount": 7,
        "formatter": "verbose",
        "encoding": "utf-8",
    }
    LOGGING["root"]["handlers"].append("file")
    LOGGING["loggers"]["django"]["handlers"].append("file")
    LOGGING["loggers"]["muhasebe"]["handlers"].append("file")

# --- E-posta (default kapalı; Anayasa: SMTP no-op) --------------------------
# Faz 13: gerçek mail YOK. Yine de Django'nun beklediği değişkenler env'den gelebilir.
EMAIL_BACKEND = os.environ.get(
    "DJANGO_EMAIL_BACKEND", "django.core.mail.backends.dummy.EmailBackend",
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "1") == "1"

# --- Telegram (Anayasa Madde 8 — Faz 13 dry-run) ----------------------------
# Gerçek gönderim YASAK — bu flag yalnız ileride Faz 16+ kararı sonrası true yapılabilir.
TELEGRAM_REAL_SEND_ENABLED = False
