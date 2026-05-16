#!/bin/sh
# Sayman API container start script.
# - Pending migration'ları background'da uygular (healthcheck'i bloklamaz).
# - API'yi foreground'da başlatır.
# Drizzle journal idempotent — uygulanmış migration'lar atlanır.

set -e

# Migration'ı background'a yolla
(
  echo "[start.sh] Migration kontrolü başlıyor (background)..."
  if pnpm --filter @sayman/db exec tsx src/migrate.ts; then
    echo "[start.sh] Migration başarılı ✓"
  else
    echo "[start.sh] HATA: Migration başarısız (devam ediliyor — manuel kontrol gerek)"
  fi
) &

# API'yi foreground'da çalıştır (PID 1)
exec pnpm --filter @sayman/api exec tsx src/index.ts
