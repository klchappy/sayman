"""Muhasebe Operasyonları — Gunicorn config (taslak, Faz 16).

systemd unit bu dosyayı --config ile yükler. Worker sayısı küçük örgüt için
düşük tutuldu (3); yük profili sonrası artırılabilir.
"""
import multiprocessing
import os

bind = os.environ.get("GUNICORN_BIND", "127.0.0.1:8001")
workers = int(os.environ.get("GUNICORN_WORKERS", "3"))
worker_class = "sync"
threads = int(os.environ.get("GUNICORN_THREADS", "1"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "60"))
graceful_timeout = 30
keepalive = 5
max_requests = 1000
max_requests_jitter = 50

# Logging — systemd journald yakalasın
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")

# Process naming
proc_name = "muhasebe-ops-gunicorn"

# Worker tmp -> RAM (low-IO)
worker_tmp_dir = "/dev/shm"

# Notify systemd Type=notify
def on_starting(server):  # noqa: D401
    server.log.info("muhasebe-ops gunicorn starting; workers=%s", workers)

# CPU bazlı otomatik worker (referans, kullanım dışı)
_cpu_suggestion = (multiprocessing.cpu_count() * 2) + 1
