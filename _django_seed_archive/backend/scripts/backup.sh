#!/usr/bin/env bash
# Muhasebe Operasyonları — Production Backup Script (taslak)
# Faz 15 Production Hardening Patch.
#
# KULLANIM:
#   /usr/local/sbin/slc-backup.sh
#   systemd timer üzerinden gece 03:30 çalıştırılır.
#
# Gerekli env:
#   DB_NAME, DB_USER, DB_HOST (default 127.0.0.1), DB_PORT (default 5432)
#   PRIVATE_MEDIA_ROOT (default /var/www/muhasebe-ops/private_media)
#   BACKUP_ROOT (default /var/backups/muhasebe-ops)
#
# .pgpass kullanımı önerilir; password env'e basılmaz.
#
# Yazılı çıktılar:
#   $BACKUP_ROOT/db/<TS>.dump          (pg_dump custom format)
#   $BACKUP_ROOT/media/<TS>.tar.gz     (private_media)
#   $BACKUP_ROOT/log/backup.log        (secret içermez; path/size/exit)
#   $BACKUP_ROOT/checksums/<TS>.sha256 (dosya bütünlüğü)

set -euo pipefail
IFS=$'\n\t'

# --- Defaults ---------------------------------------------------------------
DB_NAME="${DB_NAME:?DB_NAME zorunlu}"
DB_USER="${DB_USER:?DB_USER zorunlu}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

PRIVATE_MEDIA_ROOT="${PRIVATE_MEDIA_ROOT:-/var/www/muhasebe-ops/private_media}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/muhasebe-ops}"

TS="$(date +%F)"
DB_DIR="$BACKUP_ROOT/db"
MEDIA_DIR="$BACKUP_ROOT/media"
LOG_DIR="$BACKUP_ROOT/log"
SUM_DIR="$BACKUP_ROOT/checksums"

mkdir -p "$DB_DIR" "$MEDIA_DIR" "$LOG_DIR" "$SUM_DIR"

LOG_FILE="$LOG_DIR/backup.log"

log() {
  # secret içermez — sadece timestamp + mesaj
  echo "[$(date -Iseconds)] $*" >> "$LOG_FILE"
}

trap 'log "ERROR exit=$?"; exit 1' ERR

log "start ts=$TS"

# --- 1. PostgreSQL dump -----------------------------------------------------
DB_FILE="$DB_DIR/$TS.dump"
PGPASSFILE="${PGPASSFILE:-$HOME/.pgpass}" \
  pg_dump \
    -Fc \
    -h "$DB_HOST" -p "$DB_PORT" \
    -U "$DB_USER" -d "$DB_NAME" \
    -f "$DB_FILE"

DB_SIZE=$(stat -c %s "$DB_FILE")
log "db ok file=$DB_FILE size=$DB_SIZE"

# --- 2. Private media tar ---------------------------------------------------
MEDIA_FILE="$MEDIA_DIR/$TS.tar.gz"
if [ -d "$PRIVATE_MEDIA_ROOT" ]; then
  tar -czf "$MEDIA_FILE" \
    -C "$(dirname "$PRIVATE_MEDIA_ROOT")" \
    "$(basename "$PRIVATE_MEDIA_ROOT")"
  MEDIA_SIZE=$(stat -c %s "$MEDIA_FILE")
  log "media ok file=$MEDIA_FILE size=$MEDIA_SIZE"
else
  log "media skip (dizin yok: $PRIVATE_MEDIA_ROOT)"
fi

# --- 3. SHA-256 -------------------------------------------------------------
SUM_FILE="$SUM_DIR/$TS.sha256"
{
  sha256sum "$DB_FILE" || true
  [ -f "$MEDIA_FILE" ] && sha256sum "$MEDIA_FILE"
} > "$SUM_FILE"
log "checksum ok file=$SUM_FILE"

# --- 4. Retention (placeholder) ---------------------------------------------
# Günlük 7 / Haftalık 4 / Aylık 6 — detay için BACKUP_RESTORE_PLAN.md.
# Şimdilik yalnız 7 günden eski günlük dosyaları siler.
find "$DB_DIR" -maxdepth 1 -name '*.dump' -mtime +7 -delete 2>/dev/null || true
find "$MEDIA_DIR" -maxdepth 1 -name '*.tar.gz' -mtime +7 -delete 2>/dev/null || true
log "retention pruned daily>7"

log "done ts=$TS"
exit 0
