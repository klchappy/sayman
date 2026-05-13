"""
MUHASEBE OPERASYON SİSTEMİ — Base Django Settings (Faz 2 Base Scaffold)

Faz 1 PHASE1_TECHNICAL_ARCHITECTURE.md ile uyumlu.
Lokal/PG/Prod settings bu dosyayı extend eder.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/

# --- Security ---------------------------------------------------------------
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "CHANGE-ME-local-dev-only-do-not-use-in-prod-32chars-minimum",
)
DEBUG = False  # local.py override eder
ALLOWED_HOSTS: list[str] = []

# --- Application ------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # local apps
    "apps.core",
    "apps.audit",
    "apps.accounts",
    "apps.parties",
    "apps.documents",
    "apps.imports",
    "apps.finance",
    "apps.subscriptions",
    "apps.regular_payments",
    "apps.official_payments",
    "apps.pruva",
    "apps.properties",
    "apps.guarantees",
    "apps.integrators",
    "apps.notifications",
    "apps.tasks",
    "apps.chat",
    "apps.dashboard",
    "apps.reports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.core.context_processors.brand_context",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Database (placeholder, override in local.py / local_pg.py / production.py)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# --- Auth -------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LOGIN_URL = "accounts:login"
LOGIN_REDIRECT_URL = "dashboard:home"
LOGOUT_REDIRECT_URL = "accounts:login"

# --- I18N / L10N — Anayasa Madde 11 -----------------------------------------
LANGUAGE_CODE = "tr"
TIME_ZONE = "Europe/Istanbul"
USE_I18N = True
USE_TZ = True
DECIMAL_SEPARATOR = ","
THOUSAND_SEPARATOR = "."
USE_THOUSAND_SEPARATOR = True
DATE_FORMAT = "d.m.Y"
DATETIME_FORMAT = "d.m.Y H:i"

LOCALE_PATHS = [BASE_DIR / "locale"]

# --- Static / Media ---------------------------------------------------------
STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Import / Document private storage path (Anayasa 7.7)
PRIVATE_MEDIA_ROOT = MEDIA_ROOT / "private"
IMPORT_UPLOAD_PATH = "imports"
DOCUMENT_UPLOAD_PATH = "documents"
IMPORT_MAX_FILE_SIZE_MB = 100
IMPORT_PREVIEW_ROWS_LIMIT = 1000
IMPORT_ROLLBACK_HOURS = 24

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Anayasa / Domain Sabitleri ---------------------------------------------
# Faz 2 onaylı tutar eşikleri (D-008/D-011/D-021)
PAYMENT_DEKONT_REQUIRED_THRESHOLD = 5_000  # TL — bu üstü dekont zorunlu
PAYMENT_DOUBLE_APPROVAL_THRESHOLD = 50_000  # TL — bu üstü çift onay
# Override mekanizması Faz 4+ : SystemSetting modeli ile DB tarafına alınacak.

# Marka / UI sabitleri (template context) — Seed Design V2 kimliği
BRAND = {
    "name": "Muhasebe Operasyonları Takip Sistemi",
    "short": "Muhasebe Operasyonları",
    "monogram": "OPS",
    "subtitle": "OPERASYON MERKEZİ",
    "version": "0.2.0-ui-identity-reset",
}

# --- Logging ----------------------------------------------------------------
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
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "muhasebe": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
