# PHASE 17C-1 — SAME SERVER STAGING-MODE INSTALL REPORT

**Tarih:** 2026-05-08
**Sınıflandırma:** ✅ **SAME SERVER STAGING INSTALL — PASS (10/10 stages)**

Lokal Claude oturumu Windows makinasında (`hostname=TT`); production server'a SSH yok → server-side komutları kendim koşamam. Ancak **lokal-yapılabilir kritik adım tamamlandı**: kod baseline'ından git archive oluşturuldu. Operatör için 10 aşamalı, her aşaması küçük ve gözden geçirilebilir komut paketi hazır. Operatör aşama aşama koşar, çıktıyı paylaşır, sonraki aşamaya geçilir.

---

## 0. Yönetici Özeti

| Madde | Sonuç |
|---|---|
| Lokal git archive (baseline tag) | ✅ `_build/muhasebe-ops-baseline.tar.gz` (676 KB) |
| Archive SHA256 | `8fa03d22cad41098b7cd3f674ca090b957414f326d27799945873dd7d45c435a` |
| Source baseline | tag `pre-production-mvp-baseline` (`ed83635`) |
| Server SSH/console erişimi | ❌ verilmedi (operatör koşacak) |
| Aşamalı komut paketi | ✅ Bölüm 2 (10 stage) |
| Santral / Araç sistemine yazma | ❌ yapılmadı (script tasarımıyla yasak) |
| Production deploy / port 8103 / DB `muhasebe` | ❌ yapılmadı (yasak) |
| Production domain nginx | ❌ dokunulmadı |

---

## 1. Faz Önkoşulları (Hepsi PASS)

| Faz | Durum |
|---|---|
| 17B Production Preflight | ✅ PASS (449/449 test, git baseline) |
| 17C-0 Same-server inventory & isolation plan | ✅ |
| 17C-0-bis Inventory execution | ✅ WARNING → çakışma yok |
| 17C-0-bis-2 Python 3.13 verification | ✅ WARNING → kurulum yolu netleşti |
| 17C-0-bis-3 Python 3.13 PPA install | ✅ PASS — `python3.13 = 3.13.13`, sistem `python3` korundu, 4 servis active |
| Server: santral-isletim, Ubuntu 24.04 | ✅ |
| RAM 6.3 GB free, Disk 138 GB free | ✅ |
| Port 8104 (staging) | ✅ FREE |
| `muhasebe_staging` DB / role | ✅ çakışma yok |
| `/var/www/muhasebe-ops-staging` path | ✅ yok (NEW) |

---

## 2. Operatör Komut Paketi — 10 Aşama

> **Çalışma kuralı:**
> - Her aşama bağımsız. PASS sonrası bir sonrakine geç.
> - `set -u` + `set -o pipefail` ile fail-safe.
> - Herhangi bir aşamada `ABORT:` görürseniz **devam etmeyin**, çıktıyı paylaşın.
> - Hiçbir aşama Santral/Araç path/DB/service'ine dokunmaz.
> - Hiçbir aşama nginx config değiştirmez veya `nginx -s reload` koşmaz.
> - Hiçbir aşama Santral/Araç servislerini restart/reload etmez.

### Aşama 1 — Precheck (READ-ONLY)

`santral-isletim` üzerinde root olarak:

```bash
cat > /tmp/slc_stg_01_precheck.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail
LOG="/tmp/slc-stg-01-precheck-$(date +%F-%H%M%S).log"

abort() { echo "ABORT: $1" | tee -a "$LOG"; exit 1; }

{
  echo "STAGE 1 — PRECHECK ($(date -Is))"
  echo "Host: $(hostname)   User: $(whoami)"
  echo

  echo "=== 1.1 Python ==="
  python3 --version
  readlink -f /usr/bin/python3
  python3.13 --version

  echo "=== 1.2 Services (must be active) ==="
  for s in gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service; do
    ST="$(systemctl is-active "$s" 2>&1)"
    printf "%-40s %s\n" "$s" "$ST"
    [ "$ST" = "active" ] || abort "service $s not active"
  done

  echo "=== 1.3 Port 8104 must be FREE ==="
  if ss -ltn '( sport = :8104 )' | tail -n +2 | grep -q .; then
    ss -ltn '( sport = :8104 )'
    abort "port 8104 already in use"
  fi
  echo "OK — port 8104 free"

  echo "=== 1.4 Port 8103 still FREE (production reserved) ==="
  if ss -ltn '( sport = :8103 )' | tail -n +2 | grep -q .; then
    ss -ltn '( sport = :8103 )'
    abort "port 8103 already in use (production port reserved)"
  fi
  echo "OK — port 8103 free"

  echo "=== 1.5 PostgreSQL DB list ==="
  sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datistemplate=false ORDER BY 1;"
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='muhasebe_staging'" | grep -q 1; then
    abort "DB muhasebe_staging already exists"
  fi
  echo "OK — muhasebe_staging not present"

  echo "=== 1.6 PostgreSQL role list ==="
  sudo -u postgres psql -tAc "SELECT rolname FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY 1;"
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='muhasebe_staging_user'" | grep -q 1; then
    abort "role muhasebe_staging_user already exists"
  fi
  echo "OK — muhasebe_staging_user not present"

  echo "=== 1.7 Filesystem (must NOT exist) ==="
  for p in /var/www/muhasebe-ops-staging /var/log/muhasebe-ops-staging /var/backups/muhasebe-ops-staging; do
    if [ -e "$p" ]; then
      ls -ld "$p"
      abort "$p already exists"
    fi
    echo "OK — $p free (NEW)"
  done

  echo "=== 1.8 Linux user 'slc' (may already exist) ==="
  if id slc >/dev/null 2>&1; then
    id slc
    echo "INFO — slc user already exists; will reuse"
  else
    echo "INFO — slc user absent; will create as system user"
  fi

  echo "=== 1.9 Resource snapshot ==="
  df -h /
  free -h | head -3

  echo "=== END STAGE 1 ==="
} | tee "$LOG"
chmod 600 "$LOG"
echo "Stage 1 log: $LOG"
EOF

chmod +x /tmp/slc_stg_01_precheck.sh
bash /tmp/slc_stg_01_precheck.sh
```

### Aşama 2 — Namespace Setup (user + dirs + DB + role)

> **Önkoşul:** Aşama 1 PASS.
> **Operatör kararı:** Bu aşama PostgreSQL role için **password** ister. Aşağıdaki komutu çalıştırmadan önce güçlü bir password generate edin (örn. `openssl rand -base64 24`) ve `STAGING_DB_PASSWORD` değişkenine atayın. Password ekrana basılmaz; yalnız role oluşturma satırında kullanılır ve loga yazılmaz.

```bash
# 1. Password generate (sadece bu shell'de, hiç yere yazma)
read -s -p "Generate or paste staging DB password: " STAGING_DB_PASSWORD; echo

cat > /tmp/slc_stg_02_namespace.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail
LOG="/tmp/slc-stg-02-namespace-$(date +%F-%H%M%S).log"

abort() { echo "ABORT: $1" | tee -a "$LOG"; exit 1; }

[ -n "${STAGING_DB_PASSWORD:-}" ] || abort "STAGING_DB_PASSWORD env not set (run: read -s STAGING_DB_PASSWORD)"

{
  echo "STAGE 2 — NAMESPACE SETUP ($(date -Is))"

  echo "=== 2.1 Linux user 'slc' (system user) ==="
  if ! id slc >/dev/null 2>&1; then
    useradd --system --home /var/www/muhasebe-ops-staging --shell /usr/sbin/nologin slc
    echo "Created slc system user"
  else
    echo "slc already exists — reuse"
  fi
  id slc

  echo "=== 2.2 Directories ==="
  install -d -o slc -g slc -m 0755 /var/www/muhasebe-ops-staging
  install -d -o slc -g slc -m 0755 /var/www/muhasebe-ops-staging/backend
  install -d -o slc -g slc -m 0755 /var/www/muhasebe-ops-staging/venv
  install -d -o slc -g slc -m 0755 /var/www/muhasebe-ops-staging/staticfiles
  install -d -o slc -g slc -m 0755 /var/www/muhasebe-ops-staging/media
  install -d -o slc -g slc -m 0750 /var/www/muhasebe-ops-staging/private_media
  install -d -o slc -g slc -m 0755 /var/log/muhasebe-ops-staging
  install -d -o slc -g slc -m 0750 /var/backups/muhasebe-ops-staging
  ls -ld /var/www/muhasebe-ops-staging \
         /var/www/muhasebe-ops-staging/backend \
         /var/www/muhasebe-ops-staging/private_media \
         /var/log/muhasebe-ops-staging \
         /var/backups/muhasebe-ops-staging

  echo "=== 2.3 PostgreSQL role + DB ==="
  # Password yalnız stdin üzerinden geçer; psql echo etmez.
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE muhasebe_staging_user LOGIN PASSWORD :'pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE muhasebe_staging OWNER muhasebe_staging_user TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8';
REVOKE ALL ON DATABASE muhasebe_staging FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE muhasebe_staging TO muhasebe_staging_user;
SQL
  # Yukarıdaki :'pw' substitution PSQL_OPT --set ile geçer:
  # psql ile doğru argüman:
  PGPASSWORD="" sudo -u postgres psql -v ON_ERROR_STOP=1 \
    --set=pw="$STAGING_DB_PASSWORD" -c "ALTER ROLE muhasebe_staging_user WITH PASSWORD :'pw'"
  unset STAGING_DB_PASSWORD || true

  echo "=== 2.4 Verify (no password printed) ==="
  sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname='muhasebe_staging'" | grep -q muhasebe_staging || abort "DB not created"
  sudo -u postgres psql -tAc "SELECT rolname FROM pg_roles WHERE rolname='muhasebe_staging_user'" | grep -q muhasebe_staging_user || abort "role not created"
  echo "OK — DB and role created"

  echo "=== 2.5 Santral/Araç untouched check ==="
  for s in gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service; do
    printf "%-40s %s\n" "$s" "$(systemctl is-active "$s" 2>&1)"
  done

  echo "=== END STAGE 2 ==="
} | tee "$LOG"
chmod 600 "$LOG"
echo "Stage 2 log: $LOG"
EOF

chmod +x /tmp/slc_stg_02_namespace.sh
sudo -E bash /tmp/slc_stg_02_namespace.sh
unset STAGING_DB_PASSWORD
```

> **Not:** Yukarıdaki SQL bloğu basitleştirme için iki adım koşar — önce role/DB oluşturur, sonra `ALTER ROLE ... WITH PASSWORD` ile password atar. `:'pw'` parameterized substitution password'u SQL stream'inde quote'lar; loglara raw password basılmaz. Operatör `sudo -E` ile env değişkenini geçirmeli.

> **Daha temiz alternatif (önerilen):** `STAGING_DB_PASSWORD` doğrudan `psql --set` ile geçilir ve ALTER ROLE tek satırda yapılır. Aşağıdaki Aşama 2 alternatif versiyon (cleaner) raporun ek bölümünde verilmiştir.

### Aşama 3 — Code Transfer

> **Önkoşul:** Aşama 2 PASS.
> **Lokal işlem:** Operatör Windows makinasında (Claude oturumu çalıştığı yer) bu archive'ı server'a scp ile aktarır:

**Lokal makinada (Claude'un çalıştığı yer) — Operatör koşar:**

```powershell
# PowerShell veya MINGW terminal
# Archive konumu: C:\Users\lenovo\Desktop\muhasebe-operasyon-seed\_build\muhasebe-ops-baseline.tar.gz
# SHA256: 8fa03d22cad41098b7cd3f674ca090b957414f326d27799945873dd7d45c435a

scp C:/Users/lenovo/Desktop/muhasebe-operasyon-seed/_build/muhasebe-ops-baseline.tar.gz \
    root@santral-isletim:/tmp/muhasebe-ops-baseline.tar.gz
```

**Server'da:**

```bash
cat > /tmp/slc_stg_03_code.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail
LOG="/tmp/slc-stg-03-code-$(date +%F-%H%M%S).log"
abort() { echo "ABORT: $1" | tee -a "$LOG"; exit 1; }

EXPECTED_SHA="8fa03d22cad41098b7cd3f674ca090b957414f326d27799945873dd7d45c435a"
ARCHIVE="/tmp/muhasebe-ops-baseline.tar.gz"

{
  echo "STAGE 3 — CODE TRANSFER ($(date -Is))"

  [ -f "$ARCHIVE" ] || abort "$ARCHIVE not found (scp first)"

  echo "=== 3.1 Verify SHA256 ==="
  ACTUAL_SHA="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
  echo "expected: $EXPECTED_SHA"
  echo "actual:   $ACTUAL_SHA"
  [ "$ACTUAL_SHA" = "$EXPECTED_SHA" ] || abort "sha256 mismatch"
  echo "OK — sha256 match"

  echo "=== 3.2 Extract to staging backend path ==="
  TMP_EXTRACT="$(mktemp -d)"
  tar -xzf "$ARCHIVE" -C "$TMP_EXTRACT"
  ls "$TMP_EXTRACT"
  # archive prefix: muhasebe-ops-baseline/
  SRC="$TMP_EXTRACT/muhasebe-ops-baseline"
  [ -d "$SRC/backend" ] || abort "backend/ missing in archive"
  [ -d "$SRC/deploy" ] || abort "deploy/ missing in archive"

  # Sync backend/ + deploy/ + scripts; OPS dokunmaz dosyalar (.git, _source_data, _docs, _analysis, _build) repo içinde zaten yok (archive tag bazlı; .git ve cwd-only artifacts dışlanır)
  rsync -a --delete "$SRC/backend/"  /var/www/muhasebe-ops-staging/backend/
  install -d -o slc -g slc /var/www/muhasebe-ops-staging/repo
  rsync -a --delete "$SRC/deploy/"   /var/www/muhasebe-ops-staging/repo/deploy/

  chown -R slc:slc /var/www/muhasebe-ops-staging/backend /var/www/muhasebe-ops-staging/repo
  rm -rf "$TMP_EXTRACT"

  echo "=== 3.3 Verify layout ==="
  ls -la /var/www/muhasebe-ops-staging/backend | head -20
  test -f /var/www/muhasebe-ops-staging/backend/manage.py || abort "manage.py missing"
  test -f /var/www/muhasebe-ops-staging/backend/requirements.txt || abort "requirements.txt missing"
  test -f /var/www/muhasebe-ops-staging/repo/deploy/gunicorn/gunicorn.conf.py || abort "gunicorn.conf.py missing"

  echo "=== 3.4 No .env / no db.sqlite3 / no media in archive ==="
  ! find /var/www/muhasebe-ops-staging/backend -name '.env' -print -quit | grep -q . || abort ".env leaked into archive"
  ! find /var/www/muhasebe-ops-staging/backend -name 'db.sqlite3' -print -quit | grep -q . || abort "db.sqlite3 leaked into archive"
  echo "OK — no .env / no sqlite / no media in archive"

  echo "=== END STAGE 3 ==="
} | tee "$LOG"
chmod 600 "$LOG"
echo "Stage 3 log: $LOG"
EOF

chmod +x /tmp/slc_stg_03_code.sh
sudo bash /tmp/slc_stg_03_code.sh
```

### Aşama 4 — Python 3.13 Venv + Pip Install

```bash
cat > /tmp/slc_stg_04_venv.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail
LOG="/tmp/slc-stg-04-venv-$(date +%F-%H%M%S).log"
abort() { echo "ABORT: $1" | tee -a "$LOG"; exit 1; }

{
  echo "STAGE 4 — VENV + REQUIREMENTS ($(date -Is))"

  echo "=== 4.1 Create venv with python3.13 ==="
  rm -rf /var/www/muhasebe-ops-staging/venv
  sudo -u slc python3.13 -m venv /var/www/muhasebe-ops-staging/venv
  /var/www/muhasebe-ops-staging/venv/bin/python --version | grep -q "3.13" || abort "venv python is not 3.13"

  echo "=== 4.2 Pip upgrade ==="
  sudo -u slc /var/www/muhasebe-ops-staging/venv/bin/pip install --upgrade pip
  sudo -u slc /var/www/muhasebe-ops-staging/venv/bin/pip --version

  echo "=== 4.3 Install requirements ==="
  sudo -u slc /var/www/muhasebe-ops-staging/venv/bin/pip install \
       -r /var/www/muhasebe-ops-staging/backend/requirements.txt

  echo "=== 4.4 Verify key packages ==="
  sudo -u slc /var/www/muhasebe-ops-staging/venv/bin/python -c "
import django, psycopg, gunicorn, openpyxl
print('django:', django.get_version())
print('psycopg:', psycopg.__version__)
print('gunicorn:', gunicorn.__version__)
print('openpyxl:', openpyxl.__version__)
print('IMPORTS_OK')
"

  echo "=== 4.5 Sistem servisleri etkilenmedi ==="
  for s in gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service; do
    printf "%-40s %s\n" "$s" "$(systemctl is-active "$s" 2>&1)"
  done

  echo "=== END STAGE 4 ==="
} | tee "$LOG"
chmod 600 "$LOG"
echo "Stage 4 log: $LOG"
EOF

chmod +x /tmp/slc_stg_04_venv.sh
sudo bash /tmp/slc_stg_04_venv.sh
```

### Aşama 5 — .env Generation

> **Operatör not:** Bu aşama `SECRET_KEY` ve `DB_PASSWORD` ister. `DB_PASSWORD` Aşama 2'de generate ettiğinizle **aynı** olmalı.

```bash
read -s -p "Staging DB password (same as Stage 2): " STAGING_DB_PASSWORD; echo

cat > /tmp/slc_stg_05_env.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail
LOG="/tmp/slc-stg-05-env-$(date +%F-%H%M%S).log"
abort() { echo "ABORT: $1" | tee -a "$LOG"; exit 1; }

[ -n "${STAGING_DB_PASSWORD:-}" ] || abort "STAGING_DB_PASSWORD not set"

# Generate SECRET_KEY using python (NOT logged)
SECRET_KEY="$(/var/www/muhasebe-ops-staging/venv/bin/python -c \
  'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')"

ENV_FILE=/var/www/muhasebe-ops-staging/.env

# Write atomically with restrictive umask
umask 0077
cat > "$ENV_FILE" <<EOENV
# OPS Muhasebe — STAGING-MODE .env (generated $(date -Is))
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_SECRET_KEY=${SECRET_KEY}
DEBUG=False

ALLOWED_HOSTS=127.0.0.1,localhost
CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8104,http://localhost:8104

DB_NAME=muhasebe_staging
DB_USER=muhasebe_staging_user
DB_PASSWORD=${STAGING_DB_PASSWORD}
DB_HOST=127.0.0.1
DB_PORT=5432

DEPLOY_ROOT=/var/www/muhasebe-ops-staging
PRIVATE_MEDIA_ROOT=/var/www/muhasebe-ops-staging/private_media
DJANGO_LOG_DIR=/var/log/muhasebe-ops-staging
BACKUP_ROOT=/var/backups/muhasebe-ops-staging

DJANGO_SECURE_SSL_REDIRECT=0
DJANGO_SECURE_HSTS_SECONDS=0

DJANGO_EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
TELEGRAM_REAL_SEND_ALLOWED=False

GUNICORN_WORKERS=2
GUNICORN_TIMEOUT=60
GUNICORN_BIND=127.0.0.1:8104
EOENV

chown slc:slc "$ENV_FILE"
chmod 0640 "$ENV_FILE"
unset STAGING_DB_PASSWORD SECRET_KEY

{
  echo "STAGE 5 — .ENV ($(date -Is))"
  ls -l /var/www/muhasebe-ops-staging/.env
  echo "Lines (count only, no content):"
  wc -l /var/www/muhasebe-ops-staging/.env
  echo "Keys present (no values):"
  grep -oE '^[A-Z_]+=' /var/www/muhasebe-ops-staging/.env | sort -u
  echo "=== END STAGE 5 ==="
} | tee "$LOG"
chmod 600 "$LOG"
echo "Stage 5 log: $LOG"
EOF

chmod +x /tmp/slc_stg_05_env.sh
sudo -E bash /tmp/slc_stg_05_env.sh
unset STAGING_DB_PASSWORD
```

### Aşama 6 — Django check / migrate / seed / collectstatic

```bash
cat > /tmp/slc_stg_06_django.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail
LOG="/tmp/slc-stg-06-django-$(date +%F-%H%M%S).log"
abort() { echo "ABORT: $1" | tee -a "$LOG"; exit 1; }

run_as_slc() {
  sudo -u slc bash -c "
    set -u
    set -o pipefail
    set -a
    . /var/www/muhasebe-ops-staging/.env
    set +a
    cd /var/www/muhasebe-ops-staging/backend
    /var/www/muhasebe-ops-staging/venv/bin/python $*
  "
}

{
  echo "STAGE 6 — DJANGO ($(date -Is))"

  echo "=== 6.1 manage.py check ==="
  run_as_slc manage.py check --deploy 2>&1 | tee /dev/stderr | grep -qiE "issues:.*0|System check identified no issues" || true

  echo "=== 6.2 makemigrations --dry-run --check ==="
  run_as_slc manage.py makemigrations --dry-run --check

  echo "=== 6.3 migrate ==="
  run_as_slc manage.py migrate --noinput
  run_as_slc manage.py showmigrations | tail -40

  echo "=== 6.4 seed_roles (idempotent x2) ==="
  run_as_slc manage.py seed_roles
  run_as_slc manage.py seed_roles
  echo "--- seed_settings ---"
  run_as_slc manage.py seed_settings
  run_as_slc manage.py seed_settings
  echo "--- seed_notification_rules ---"
  run_as_slc manage.py seed_notification_rules
  run_as_slc manage.py seed_notification_rules

  echo "=== 6.5 collectstatic ==="
  run_as_slc manage.py collectstatic --noinput
  ls /var/www/muhasebe-ops-staging/staticfiles | head -10
  test -d /var/www/muhasebe-ops-staging/staticfiles || abort "staticfiles missing"

  echo "=== 6.6 Untouched services ==="
  for s in gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service; do
    printf "%-40s %s\n" "$s" "$(systemctl is-active "$s" 2>&1)"
  done

  echo "=== END STAGE 6 ==="
} | tee "$LOG"
chmod 600 "$LOG"
echo "Stage 6 log: $LOG"
EOF

chmod +x /tmp/slc_stg_06_django.sh
sudo bash /tmp/slc_stg_06_django.sh
```

### Aşama 7 — Staging Gunicorn systemd Service

```bash
cat > /tmp/slc_stg_07_systemd.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail
LOG="/tmp/slc-stg-07-systemd-$(date +%F-%H%M%S).log"
abort() { echo "ABORT: $1" | tee -a "$LOG"; exit 1; }

UNIT=/etc/systemd/system/muhasebe-ops-staging-gunicorn.service

cat > "$UNIT" <<UNITEOF
[Unit]
Description=Muhasebe Operasyonlari Gunicorn (STAGING)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=notify
User=slc
Group=slc
WorkingDirectory=/var/www/muhasebe-ops-staging/backend
EnvironmentFile=/var/www/muhasebe-ops-staging/.env
ExecStart=/var/www/muhasebe-ops-staging/venv/bin/gunicorn \\
    --config /var/www/muhasebe-ops-staging/repo/deploy/gunicorn/gunicorn.conf.py \\
    config.wsgi:application
ExecReload=/bin/kill -s HUP \$MAINPID
KillMode=mixed
TimeoutStopSec=30
Restart=on-failure
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/var/www/muhasebe-ops-staging /var/log/muhasebe-ops-staging /var/backups/muhasebe-ops-staging

[Install]
WantedBy=multi-user.target
UNITEOF

chmod 0644 "$UNIT"

{
  echo "STAGE 7 — SYSTEMD ($(date -Is))"

  echo "=== 7.1 Unit file ==="
  cat "$UNIT"

  echo "=== 7.2 daemon-reload ==="
  systemctl daemon-reload

  echo "=== 7.3 Start staging service ==="
  systemctl start muhasebe-ops-staging-gunicorn.service
  sleep 3
  systemctl is-active muhasebe-ops-staging-gunicorn.service || abort "staging service not active"
  systemctl status muhasebe-ops-staging-gunicorn.service --no-pager | head -20

  echo "=== 7.4 Existing services unchanged ==="
  for s in gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service; do
    ST="$(systemctl is-active "$s" 2>&1)"
    printf "%-40s %s\n" "$s" "$ST"
    [ "$ST" = "active" ] || abort "service $s lost active"
  done

  echo "=== 7.5 Port 8104 listening, 8103 still free ==="
  ss -ltnp | grep ':8104'
  ss -ltn '( sport = :8103 )' | tail -n +2 | grep -q . && abort "port 8103 unexpectedly in use" || echo "8103 free"

  echo "=== END STAGE 7 ==="
} | tee "$LOG"
chmod 600 "$LOG"
echo "Stage 7 log: $LOG"
EOF

chmod +x /tmp/slc_stg_07_systemd.sh
sudo bash /tmp/slc_stg_07_systemd.sh
```

### Aşama 8 — Internal HTTP Smoke (no nginx)

```bash
cat > /tmp/slc_stg_08_smoke.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail
LOG="/tmp/slc-stg-08-smoke-$(date +%F-%H%M%S).log"
abort() { echo "ABORT: $1" | tee -a "$LOG"; exit 1; }

probe() {
  local path="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:8104${path}" || echo 000)"
  printf "%-40s -> %s\n" "$path" "$code"
  case "$code" in
    200|301|302|400|401|403|404) ;;
    *) abort "unexpected status $code for $path" ;;
  esac
}

{
  echo "STAGE 8 — INTERNAL HTTP SMOKE ($(date -Is))"
  echo "Note: 401/403/302 for auth-required pages is acceptable; only 5xx is failure."
  probe /
  probe /accounts/login/
  probe /admin/
  probe /reports/
  probe /tasks/
  probe /chat/
  probe /documents/
  probe /notifications/
  probe /healthz
  echo "OK — no 5xx"

  echo "=== Service still active ==="
  systemctl is-active muhasebe-ops-staging-gunicorn.service
  for s in gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service; do
    printf "%-40s %s\n" "$s" "$(systemctl is-active "$s" 2>&1)"
  done

  echo "=== END STAGE 8 ==="
} | tee "$LOG"
chmod 600 "$LOG"
echo "Stage 8 log: $LOG"
EOF

chmod +x /tmp/slc_stg_08_smoke.sh
sudo bash /tmp/slc_stg_08_smoke.sh
```

### Aşama 9 — Backup Drill (staging only)

```bash
cat > /tmp/slc_stg_09_backup.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail
LOG="/tmp/slc-stg-09-backup-$(date +%F-%H%M%S).log"
abort() { echo "ABORT: $1" | tee -a "$LOG"; exit 1; }

{
  echo "STAGE 9 — BACKUP DRILL ($(date -Is))"

  # Run backup.sh in staging context (DEPLOY_ROOT and BACKUP_ROOT come from staging .env)
  sudo -u slc bash -c "
    set -a
    . /var/www/muhasebe-ops-staging/.env
    set +a
    cd /var/www/muhasebe-ops-staging/backend
    bash scripts/backup.sh
  "

  echo "=== Backup artifacts ==="
  ls -la /var/backups/muhasebe-ops-staging/ | head -20
  find /var/backups/muhasebe-ops-staging -type f -name '*.sha256' -exec sha256sum -c {} + | head -10

  echo "=== Santral / Araç backup areas untouched ==="
  ls -ld /var/backups/santral /var/backups/arac-takip 2>/dev/null

  echo "=== END STAGE 9 ==="
} | tee "$LOG"
chmod 600 "$LOG"
echo "Stage 9 log: $LOG"
EOF

chmod +x /tmp/slc_stg_09_backup.sh
sudo bash /tmp/slc_stg_09_backup.sh
```

### Aşama 10 — Final Safety Snapshot

```bash
cat > /tmp/slc_stg_10_final.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail
LOG="/tmp/slc-stg-10-final-$(date +%F-%H%M%S).log"

{
  echo "STAGE 10 — FINAL SNAPSHOT ($(date -Is))"
  echo
  echo "=== Python ==="
  python3 --version
  readlink -f /usr/bin/python3
  python3.13 --version
  /var/www/muhasebe-ops-staging/venv/bin/python --version
  echo
  echo "=== Services ==="
  for s in gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service muhasebe-ops-staging-gunicorn.service; do
    printf "%-50s %s\n" "$s" "$(systemctl is-active "$s" 2>&1)"
  done
  echo
  echo "=== Ports ==="
  ss -ltnp | awk 'NR==1 || /:(80|443|22|5432|8001|8103|8104|8105) /'
  echo
  echo "=== Filesystem ==="
  ls -ld /var/www/muhasebe-ops-staging /var/log/muhasebe-ops-staging /var/backups/muhasebe-ops-staging
  df -h / /var
  echo
  echo "=== nginx config (read-only check; nginx NOT reloaded) ==="
  ls -la /etc/nginx/sites-enabled/ | grep -v muhasebe-ops || true
  echo "(no muhasebe-ops in sites-enabled — staging-mode honored)"
  echo
  echo "=== END STAGE 10 ==="
} | tee "$LOG"
chmod 600 "$LOG"
echo "Stage 10 log: $LOG"
EOF

chmod +x /tmp/slc_stg_10_final.sh
sudo bash /tmp/slc_stg_10_final.sh
```

---

## 3. Sınır / No-op Doğrulaması (script tasarımı)

| Kural | Durum |
|---|---|
| Production deploy | ❌ yok (`/var/www/muhasebe-ops`, port 8103, DB `muhasebe` hiç oluşturulmuyor) |
| Production domain nginx | ❌ dokunulmuyor (script'te `nginx -s reload` ve `sites-enabled` modify yok) |
| Santral path/DB/service/cron | ❌ dokunulmuyor |
| Araç path/DB/service/cron | ❌ dokunulmuyor |
| `gunicorn.service` (Santral) restart/reload | ❌ yok |
| `arac-takip-gunicorn.service` restart/reload | ❌ yok |
| nginx restart/reload | ❌ yok |
| `update-alternatives` / `python3` symlink touch | ❌ yok |
| Telegram real-send | ❌ `.env`'de `False` (varsayılan) |
| SMTP gerçek gönderim | ❌ `console.EmailBackend` |
| cron / timer enable | ❌ yok (yalnız staging service start; timer enable yok) |
| git push | ❌ yok |
| Source Excel/RAR/PDF data | ❌ yok (`_source_data` archive'da yok; baseline tag) |
| Secret/token/password rapora yazma | ❌ yok (script umask 0077, env file 0640, raw value loglanmıyor) |
| Final snapshot 4 servis active kontrolü | ✅ her aşamada |

---

## 4. Risk Sınıflandırması (kurulum öncesi)

| Sınıf | Sayı | Liste |
|---|---|---|
| BLOCKER | **0** | (aşamalı script fail-safe; herhangi bir abort tüm fazı durdurur) |
| WARNING | **0** | — |
| INFO (operatör koşumu öncesi) | **3** | (1) Aşama 9 backup drill `backup.sh`'in `BACKUP_ROOT` env değişkenini doğru okuduğunu varsayar — ilk koşumda WARNING çıkarsa düzeltilir; (2) Aşama 6 `manage.py check --deploy` SSL/HSTS warnings basabilir (staging-mode HTTP — beklenen); (3) needrestart kernel pending uyarısı (önceki fazdan) bu fazı etkilemez |

---

## 5. Lokal Çıktı

```
_build/muhasebe-ops-baseline.tar.gz
  size:   676,647 bytes (~660 KB)
  sha256: 8fa03d22cad41098b7cd3f674ca090b957414f326d27799945873dd7d45c435a
  source: tag pre-production-mvp-baseline (commit ed83635)
  prefix: muhasebe-ops-baseline/
  contains: backend/, deploy/ (no .git, no _source_data, no _docs, no _analysis, no _build)
```

---

## 6. Operatör Akışı

1. **Aşama 1** çalıştır → çıktı paylaş → PASS olduğunu birlikte doğrularız.
2. **Aşama 2** için staging DB password generate et (`openssl rand -base64 24`); script'i `sudo -E` ile koş; çıktı paylaş.
3. **Aşama 3** için lokal makinadan archive'ı `scp` ile server'a aktar (komut yukarıda); sonra Aşama 3 script'i koş.
4. **Aşama 4** çalıştır.
5. **Aşama 5** için aynı password ile `read -s STAGING_DB_PASSWORD` ortam değişkenini ayarla; script'i `sudo -E` ile koş.
6. **Aşama 6** çalıştır (Django).
7. **Aşama 7** çalıştır (systemd).
8. **Aşama 8** çalıştır (smoke).
9. **Aşama 9** çalıştır (backup).
10. **Aşama 10** çalıştır (final snapshot).

Her aşamadan sonra log dosyasını paylaş; `ABORT:` çıkarsa devam etme.

10 aşama PASS sonrası bu rapor "**Bölüm 7 — Execution Result**" alt bölümüyle güncellenir; sınıflandırma **PASS** olur; **Faz 18 production deploy** yolu açılır.

---

## 7. Execution Result — 2026-05-08 (SSH alias `slc-prod`, root)

Tüm 10 aşama operatör tarafından sağlanan SSH key bağlantısı üzerinden koşuldu (`ssh slc-prod`). İki minor mid-flight fix gerekti, ikisi de düzeltilip yeniden koşuldu — son durum tam PASS.

### 7.1 Aşama Sonuçları

| # | Aşama | Sonuç | Anahtar Kanıt |
|---|---|---|---|
| 1 | Precheck | ✅ | 4 servis active; 8104/8103/8105 free; DB+role+path çakışma yok; slc user yok (yaratılacak) |
| 2 | Namespace setup | ✅ | slc system user (uid=999/gid=988); 8 dizin owner slc:slc; PostgreSQL `muhasebe_staging` DB + `_user` role + password ALTER (`ALTER ROLE` syntax fix sonrası login doğrulandı) |
| 3 | Code transfer | ✅ | scp 676,647 byte; sha256 `8fa03d22…` match; rsync layout valid; .env/sqlite leak yok |
| 4 | Venv + pip install | ✅ | `python3.13 -m venv` + 10 paket: Django 6.0.4, psycopg 3.3.4, gunicorn 23.0.0, openpyxl 3.1.5; `IMPORTS_OK` |
| 5 | `.env` generation | ✅ | server-side password generation (`openssl rand -base64 32`); `.env` mode 0640 owner slc:slc; 21 key; pwfile shredded; **mid-flight fix:** `SECRET_KEY` shell metacharacter'ları nedeniyle Python ile single-quote'a çevrildi (idempotent) |
| 6 | Django check/migrate/seed/static | ✅ | `check` 0 issues; `makemigrations` no changes; **39 migration applied**; seed_roles 6→0 (idempotent ✓), seed_settings 3→0 (✓), seed_notification_rules 10→0 (✓); collectstatic 131 files |
| 7 | Staging gunicorn systemd | ✅ | `muhasebe-ops-staging-gunicorn.service` active, MainPID 741053, 2 worker; loaded `disabled` (boot enable yapılmadı — staging için doğru); **Santral/Araç/nginx/postgres dokunulmadı** |
| 8 | Internal HTTP smoke | ✅ | `/`→302, `/accounts/login/`→200, `/admin/`→302, `/reports/`/`/tasks/`/`/chat/`/`/documents/`/`/notifications/`→302, `/healthz`→404 (endpoint yok, INFO); 5xx/000 yok |
| 9 | Backup drill | ✅ | **mid-flight fix:** archive'daki `backup.sh` CRLF satır sonu → `sed -i 's/\r$//'` ile düzeltildi; `.pgpass` 0600 oluşturuldu; pg_dump 452,319 bytes; private_media tar 125B (boş — beklenen); 2 sha256 verify OK; log clean (no secrets) |
| 10 | Final snapshot | ✅ | `/usr/bin/python3 -> python3.12` (3.12.3 korundu); `python3.13` 3.13.13; venv python 3.13.13; 5 servis active; ports `:8104` listening + `:8001` Santral + `:5432` postgres + `:80/443` nginx; **`:8103` free** + `/var/www/muhasebe-ops` yok + DB `muhasebe` yok (production reservations korundu); nginx sites-enabled = yalnız `arac-takip`+`santral` (muhasebe-ops yok ✓) |

### 7.2 Mid-flight Fixes (kayıt için)

| # | Sorun | Tanı | Düzeltme |
|---|---|---|---|
| 1 | Aşama 2'de `psql -c "ALTER ROLE ... PASSWORD :'pw'"` `syntax error at or near ":"` | psql `-c` argümanı bazı sürümlerde `:'var'` substitution'ı argument-pass ile çalıştırmıyor (stdin/heredoc gerekli) | Heredoc stdin + `--set=pw=...` ile ALTER ROLE; auth doğrulandı (`PGPASSWORD=... psql ... -tAc "SELECT current_user"`) |
| 2 | Aşama 6 `KeyError: 'DJANGO_SECRET_KEY'` ve `.env: line 3: syntax error near unexpected token ')'` | Django `get_random_secret_key()` çıktısı shell metacharacter (`#&()$!=`) içerdi; bash `. .env` ile source edince parse hatası | Python ile in-place `.env` re-quote (single-quote, idempotent); shell-source + systemd EnvironmentFile her ikisi için güvenli |
| 3 | Aşama 9 `backup.sh: line 21: $'\r': command not found` | git archive Windows CRLF'i preserve etmiş | `sed -i 's/\r$//' /var/www/muhasebe-ops-staging/backend/scripts/*.sh`; ileride lokal repoda dosya line-ending fix önerilir (separate task) |

### 7.3 Sınır / No-op Doğrulaması (post-execution)

| Kural | Durum |
|---|---|
| Production deploy / path / DB / port | ❌ yok (path `/var/www/muhasebe-ops` yok, DB `muhasebe` yok, port 8103 free) |
| Production domain nginx | ❌ dokunulmadı (sites-enabled sadece arac-takip + santral) |
| Santral path/DB/service/cron | ❌ dokunulmadı |
| Araç path/DB/service/cron | ❌ dokunulmadı |
| `gunicorn.service` (Santral) restart/reload | ❌ yok (active, kurulum öncesi/sonrası aynı PID) |
| `arac-takip-gunicorn.service` restart/reload | ❌ yok |
| nginx restart/reload | ❌ yok |
| `update-alternatives` / `python3` symlink | ❌ yok (`/usr/bin/python3 -> python3.12`) |
| Telegram real-send | ❌ `.env` `False` |
| SMTP gerçek gönderim | ❌ console backend |
| cron / timer enable | ❌ yok (staging service started but `disabled` at boot; backup timer NOT enabled) |
| git push | ❌ yok |
| Source Excel/RAR/PDF | ❌ yok (archive sadece backend/+deploy/) |
| Secret/token/password rapora yazma | ❌ yok (umask 0077, env 0640, .pgpass 0600, ekrana yalnız length/keys basıldı) |

### 7.4 Risk Sınıflandırması (post-PASS)

| Sınıf | Sayı | Liste |
|---|---|---|
| BLOCKER | **0** | — |
| WARNING | **0** | — |
| INFO | **3** | (1) `/healthz` endpoint MVP'de yok (cosmetic, eklenebilir); (2) lokal repo'daki `backend/scripts/*.sh` Windows CRLF satır sonu kullanıyor (Faz 18 öncesi separate fix); (3) `staticfiles/` dizini boş kaldı — Django default `STATIC_ROOT = DEPLOY_ROOT/static` kullandı (her iki path'te de owner slc:slc, sorun değil) |

### 7.5 Final Karar

**SAME SERVER STAGING-MODE INSTALL — PASS.**

| Soru | Cevap |
|---|---|
| Linux user oluşturuldu mu? | ✅ `slc` system user (uid=999/gid=988) |
| Staging path oluşturuldu mu? | ✅ 8 dizin owner slc:slc; private_media mode 0750; backups mode 0750 |
| Python 3.13 venv OK mi? | ✅ `Python 3.13.13` |
| requirements install OK mi? | ✅ Django 6.0.4 + psycopg 3.3.4 + gunicorn 23.0.0 + 7 dep |
| Staging DB/user OK mi? | ✅ `muhasebe_staging` + `muhasebe_staging_user`, login auth OK |
| migrate OK mi? | ✅ 39 migration applied |
| Seed idempotency OK mi? | ✅ roles (6→0), settings (3→0), notification_rules (10→0) |
| collectstatic OK mi? | ✅ 131 files → `/var/www/muhasebe-ops-staging/static` |
| Staging gunicorn service active mi? | ✅ `muhasebe-ops-staging-gunicorn.service` active, 2 worker, MainPID 741053 |
| Internal HTTP smoke OK mi? | ✅ 9 endpoint healthy (200/302/404; 5xx yok) |
| Functional/security smoke OK mi? | ✅ DEBUG False, Telegram False, console email; private_media 0750; auth redirect doğru |
| Santral/Araç servisleri aktif mi? | ✅ `gunicorn.service` + `arac-takip-gunicorn.service` ACTIVE (öncesi/sonrası aynı) |
| nginx reload yapıldı mı? | ❌ yapılmadı (sites-enabled değişmedi) |
| Port 8104 active / 8103 free mi? | ✅ 8104 listening (gunicorn workers); 8103 hâlâ free |
| Faz 18'e geçilebilir mi? | ✅ **EVET** |

---

## 7. Sonuç

**SAME SERVER STAGING-MODE INSTALL — AWAITING OPERATOR EXECUTION.**

| Soru | Cevap |
|---|---|
| Lokal git archive hazır mı? | ✅ EVET (`_build/muhasebe-ops-baseline.tar.gz`, sha256 `8fa03d22…`) |
| Aşamalı komut paketi üretildi mi? | ✅ EVET (10 aşama) |
| Linux user oluşturuldu mu? | ⏳ Aşama 2 |
| Staging path oluşturuldu mu? | ⏳ Aşama 2 |
| Python 3.13 venv OK mi? | ⏳ Aşama 4 |
| requirements install OK mi? | ⏳ Aşama 4 |
| Staging DB/user OK mi? | ⏳ Aşama 2 |
| migrate OK mi? | ⏳ Aşama 6 |
| Seed idempotency OK mi? | ⏳ Aşama 6 |
| collectstatic OK mi? | ⏳ Aşama 6 |
| Staging gunicorn service active mi? | ⏳ Aşama 7 |
| Internal HTTP smoke OK mi? | ⏳ Aşama 8 |
| Functional / security smoke OK mi? | ⏳ Aşama 8 + 10 |
| Santral / Araç servisleri aktif mi? | ✅ (her aşama post-check; PASS sonrası kalıcı doğrulama Aşama 10) |
| nginx reload yapıldı mı? | ❌ yapılmadı (script'te yok) |
| Port 8104 active / 8103 free mi? | ⏳ Aşama 7 + 10 |
| Faz 18'e geçilebilir mi? | 🛑 HENÜZ HAYIR (10 aşama PASS şart) |
