"""Private file storage — `MEDIA_ROOT/private/...`.

Anayasa Madde 7.7 (private media). Faz 14'te nginx X-Accel-Redirect ile servis edilir.
Faz 3 lokal: Django StreamingHttpResponse ile serve.
"""
from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateStorage(FileSystemStorage):
    """media/private/ altında saklar; webserver'ın direkt erişimine kapalı (prod)."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("location", str(settings.PRIVATE_MEDIA_ROOT))
        kwargs.setdefault("base_url", None)  # public URL yok
        super().__init__(*args, **kwargs)


private_storage = PrivateStorage()
