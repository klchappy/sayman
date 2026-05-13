"""
Document modeli — Anayasa Madde 3.18 + PHASE1_DATA_MODEL_PLAN.md A.7.

Faz 3 kapsamı:
- sha256 hash hesaplama (dedup)
- private storage path
- yetki kontrollü download
"""
import hashlib
import os
import uuid

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel

from .storage import private_storage


class DocumentType(models.TextChoices):
    INVOICE = "INVOICE", "Fatura"
    RECEIPT = "RECEIPT", "Dekont / Makbuz"
    CONTRACT = "CONTRACT", "Sözleşme"
    STATEMENT = "STATEMENT", "Ekstre"
    TAX_RECEIPT = "TAX_RECEIPT", "Vergi Makbuzu"
    GUARANTEE_LETTER = "GUARANTEE_LETTER", "Teminat Mektubu"
    IMPORT_SOURCE = "IMPORT_SOURCE", "Import Kaynağı"
    OTHER = "OTHER", "Diğer"


class DocumentSource(models.TextChoices):
    UPLOAD = "UPLOAD", "Manuel Yükleme"
    IMPORT = "IMPORT", "Import Çıktısı"
    SYSTEM = "SYSTEM", "Sistem Üretimi"


def _document_upload_path(instance, filename):
    """`documents/<sha256_first2>/<sha256>.<ext>`"""
    sha = instance.sha256 or "_pending"
    ext = (instance.extension or os.path.splitext(filename)[1].lstrip(".")).lower() or "bin"
    return f"{settings.DOCUMENT_UPLOAD_PATH}/{sha[:2] if sha != '_pending' else 'tmp'}/{sha}.{ext}"


class Document(BaseModel):
    """
    Yüklenen veya import edilen kalıcı dosya kaydı.

    sha256 ile dedup zorunlu — `Document.get_or_create_from_file()` kullanılmalı.
    """

    title = models.CharField(max_length=255, verbose_name="Başlık")
    original_filename = models.CharField(max_length=255, verbose_name="Orijinal Ad")
    stored_filename = models.CharField(max_length=255, blank=True, default="", verbose_name="Sistem Adı")

    file = models.FileField(upload_to=_document_upload_path, storage=private_storage, max_length=512)

    file_size = models.BigIntegerField(default=0, verbose_name="Boyut (byte)")
    sha256 = models.CharField(max_length=64, unique=True, db_index=True, verbose_name="SHA-256")
    mime_type = models.CharField(max_length=128, blank=True, default="")
    extension = models.CharField(max_length=16, blank=True, default="")

    document_type = models.CharField(
        max_length=24, choices=DocumentType.choices, default=DocumentType.OTHER, db_index=True,
    )
    source = models.CharField(
        max_length=16, choices=DocumentSource.choices, default=DocumentSource.UPLOAD,
    )

    related_app = models.CharField(max_length=64, blank=True, default="")
    related_model = models.CharField(max_length=64, blank=True, default="")
    related_object_id = models.CharField(max_length=64, blank=True, default="")

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="documents_uploaded",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    is_private = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Belge"
        verbose_name_plural = "Belgeler"
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["document_type", "-uploaded_at"]),
            models.Index(fields=["related_app", "related_model", "related_object_id"]),
        ]

    def __str__(self):
        return self.title or self.original_filename or f"Document #{self.pk}"

    # --- Helper class methods -----------------------------------------------

    @staticmethod
    def compute_sha256(file_obj) -> str:
        """File-like nesne için sha256 hesapla (stream)."""
        h = hashlib.sha256()
        was_open = hasattr(file_obj, "read")
        if hasattr(file_obj, "seek"):
            try:
                file_obj.seek(0)
            except Exception:
                pass
        for chunk in iter(lambda: file_obj.read(64 * 1024), b""):
            if not chunk:
                break
            h.update(chunk if isinstance(chunk, bytes) else chunk.encode("utf-8"))
        if hasattr(file_obj, "seek"):
            try:
                file_obj.seek(0)
            except Exception:
                pass
        return h.hexdigest()

    @classmethod
    def get_or_create_from_file(
        cls,
        django_file,
        *,
        uploaded_by=None,
        document_type=DocumentType.OTHER,
        source=DocumentSource.UPLOAD,
        title="",
        metadata=None,
    ):
        """
        sha256 ile dedup — varsa mevcut Document döner (created=False).

        Returns: (document, created: bool)
        """
        sha = cls.compute_sha256(django_file)
        existing = cls.objects.filter(sha256=sha).first()
        if existing:
            return existing, False

        ext = os.path.splitext(getattr(django_file, "name", ""))[1].lstrip(".").lower()
        size = getattr(django_file, "size", None)
        if size is None:
            try:
                django_file.seek(0, os.SEEK_END)
                size = django_file.tell()
                django_file.seek(0)
            except Exception:
                size = 0

        doc = cls(
            title=title or os.path.splitext(getattr(django_file, "name", ""))[0][:255],
            original_filename=getattr(django_file, "name", "")[:255],
            sha256=sha,
            extension=ext,
            file_size=size,
            document_type=document_type,
            source=source,
            uploaded_by=uploaded_by,
            metadata=metadata or {},
        )
        # Save dosya yolu sha256 üzerinden hesaplanır
        doc.file.save(getattr(django_file, "name", f"{sha}.{ext or 'bin'}"), django_file, save=False)
        doc.stored_filename = os.path.basename(doc.file.name)
        doc.save()
        return doc, True
