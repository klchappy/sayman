# MUHASEBE OPERASYON SİSTEMİ — backend

Django 5 / Python 3.12+ / PostgreSQL 15+. Faz 2 Base Scaffold.

> ⚠ Bu proje **diğer Acme projelerinden tamamen izoledir** (Anayasa Madde 1.5).

## Kurulum

```bash
# 1. Sanal ortam
python -m venv ../.venv
../.venv/Scripts/activate          # Windows
# source ../.venv/bin/activate     # Linux/macOS

# 2. Bağımlılıklar
pip install "Django>=5.1,<5.3" "psycopg[binary]" "python-decouple" pytest pytest-django

# 3. Migration + seed
python manage.py migrate
python manage.py seed_roles

# 4. İlk superuser
python manage.py createsuperuser

# 5. Çalıştır
python manage.py runserver 8200
```

Tarayıcıda: http://127.0.0.1:8200/accounts/login/

## Settings ortamları

| Ortam | DJANGO_SETTINGS_MODULE | DB |
|---|---|---|
| Lokal (default) | `config.settings.local` | SQLite |
| Lokal PostgreSQL | `config.settings.local_pg` | PostgreSQL |
| Prod placeholder | `config.settings.production` | PostgreSQL (env'den) |

## Test

```bash
PYTHONIOENCODING=utf-8 python manage.py test tests
```

## Faz Durumu

- ✅ Faz 0A/0B/0C: Analiz + Anayasa + UI/UX
- ✅ Sprint 1A-1H: 26 design frame + freeze
- ✅ Faz 1: Teknik mimari planı (9 doküman)
- 🟢 **Faz 2: Base Scaffold (bu)**
- ⏳ Faz 3: Import Merkezi
- ⏳ Faz 4: Fatura/Ödeme MVP
- ... → Faz 14: Prod deploy

## Yapılmayanlar (sınır)

Anayasa + Faz 2 talimat sınırı:
- ❌ Telegram gerçek gönderim (Faz 12)
- ❌ Gerçek import commit (Faz 3)
- ❌ Channels/WebSocket chat (Faz 11)
- ❌ Celery worker/beat (Faz 10+)
- ❌ Prod deploy (Faz 14)

## Lisans

Özel — Şirket Grubu iç kullanım.
