#!/usr/bin/env bash
# Muhasebe Operasyonları — Production Deploy Script (taslak)
# Faz 16 Production Deploy Prep.
#
# Bu script SUNUCUDA elle çalıştırılmak üzere TASLAKTIR. CI/CD yoktur.
# Çalıştırmadan önce:
#   1. /etc/muhasebe-ops/.env hazır ve 0640
#   2. PostgreSQL kullanıcısı + DB oluşturulmuş
#   3. /var/www/muhasebe-ops + /var/log/muhasebe-ops + /var/backups/muhasebe-ops açık
#   4. CONFIRM_DEPLOY=yes env ile çağır
#
# KULLANIM:
#   sudo CONFIRM_DEPLOY=yes /var/www/muhasebe-ops/repo/backend/scripts/deploy.sh

set -euo pipefail
IFS=$'\n\t'

# --- Guard ------------------------------------------------------------------
if [ "${CONFIRM_DEPLOY:-}" != "yes" ]; then
  echo "ABORT: CONFIRM_DEPLOY=yes değil. Deploy iptal." >&2
  exit 2
fi

# --- Defaults ---------------------------------------------------------------
DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/muhasebe-ops}"
REPO_DIR="${REPO_DIR:-$DEPLOY_ROOT/repo}"
VENV_DIR="${VENV_DIR:-$DEPLOY_ROOT/venv}"
ENV_FILE="${ENV_FILE:-/etc/muhasebe-ops/.env}"
SERVICE_NAME="${SERVICE_NAME:-muhasebe-ops-gunicorn.service}"

BACKEND_DIR="$REPO_DIR/backend"

echo "[deploy] DEPLOY_ROOT=$DEPLOY_ROOT"
echo "[deploy] REPO_DIR=$REPO_DIR"
echo "[deploy] VENV_DIR=$VENV_DIR"

# --- 1. Pre-flight ----------------------------------------------------------
[ -d "$REPO_DIR" ] || { echo "ABORT: REPO_DIR yok: $REPO_DIR" >&2; exit 3; }
[ -d "$VENV_DIR" ] || { echo "ABORT: VENV_DIR yok: $VENV_DIR" >&2; exit 3; }
[ -f "$ENV_FILE" ] || { echo "ABORT: ENV_FILE yok: $ENV_FILE" >&2; exit 3; }
[ -f "$BACKEND_DIR/manage.py" ] || { echo "ABORT: manage.py yok" >&2; exit 3; }

# Env'i shell'e yükle (yorum satırları/boşluklar atlanır)
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# --- 2. Yedek anchor --------------------------------------------------------
echo "[deploy] backup anchor (rollback için son DB dump'ı kontrol)"
ls -lh "${BACKUP_ROOT:-/var/backups/muhasebe-ops}/db" 2>/dev/null | tail -n 3 || true

# --- 3. Python deps ---------------------------------------------------------
echo "[deploy] pip install -r requirements.txt"
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt"

# --- 4. Django check + migrations dry-run -----------------------------------
echo "[deploy] manage.py check --deploy"
"$VENV_DIR/bin/python" "$BACKEND_DIR/manage.py" check --deploy

echo "[deploy] makemigrations --check --dry-run (yeni migration BEKLENMİYOR)"
"$VENV_DIR/bin/python" "$BACKEND_DIR/manage.py" makemigrations --check --dry-run

# --- 5. Migrate -------------------------------------------------------------
echo "[deploy] migrate"
"$VENV_DIR/bin/python" "$BACKEND_DIR/manage.py" migrate --noinput

# --- 6. Static --------------------------------------------------------------
echo "[deploy] collectstatic"
"$VENV_DIR/bin/python" "$BACKEND_DIR/manage.py" collectstatic --noinput

# --- 7. Seedler (idempotent) ------------------------------------------------
echo "[deploy] seed komutları"
"$VENV_DIR/bin/python" "$BACKEND_DIR/manage.py" seed_roles || true
"$VENV_DIR/bin/python" "$BACKEND_DIR/manage.py" seed_settings || true
"$VENV_DIR/bin/python" "$BACKEND_DIR/manage.py" seed_notification_rules || true

# --- 8. Gunicorn reload (placeholder) ---------------------------------------
echo "[deploy] systemd reload: $SERVICE_NAME"
# systemctl daemon-reload
# systemctl restart "$SERVICE_NAME"
# systemctl status --no-pager "$SERVICE_NAME" | head -n 20

# --- 9. Smoke (placeholder) -------------------------------------------------
echo "[deploy] smoke: PRODUCTION_SMOKE_COMMANDS.md adımlarını elle koş"

# --- 10. Rollback notu ------------------------------------------------------
echo "[deploy] sorun olursa: _docs/PRODUCTION_ROLLBACK_PLAN.md"

echo "[deploy] DONE"
exit 0
