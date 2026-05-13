# Sayman backend — multi-stage Dockerfile
# Hem dev (docker-compose üzerinden) hem prod (Coolify) için ortak base.

FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Sistem paketleri:
#   - build-essential + libpq-dev: psycopg derleme + django-tenants postgresql_backend
#   - locales: TR locale + dd.MM.yyyy / ₺ formatları
#   - tzdata: Europe/Istanbul (zaten requirements.txt'de tzdata var ama sistem TZ için)
#   - curl: healthcheck için
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        locales \
        tzdata \
        curl \
    && sed -i 's/# tr_TR.UTF-8 UTF-8/tr_TR.UTF-8 UTF-8/' /etc/locale.gen \
    && locale-gen tr_TR.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=tr_TR.UTF-8 \
    LC_ALL=tr_TR.UTF-8 \
    TZ=Europe/Istanbul

WORKDIR /app

# Pip cache koruma için önce sadece requirements
COPY requirements.txt /app/
RUN pip install -r requirements.txt

# Kalan kaynak kod
COPY . /app/

# Static collect için (production), dev'de skip edilebilir
ENV DJANGO_SETTINGS_MODULE=config.settings.local_pg

EXPOSE 8000

# Default komut — docker-compose her servis için override eder
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
