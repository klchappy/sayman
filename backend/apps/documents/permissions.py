"""Belge erişim helper'ları — Faz 15 Production Hardening.

Faz 14 BLOCKER B4: Login eden her kullanıcı her belgeyi indirebiliyordu.
Bu modül object-level permission yapısını sağlar.

Karar matrisi (öncelik sırası):
  1. Anonymous / unauthenticated -> False
  2. is_superuser veya yüksek rol (yonetici / muhasebe_muduru) -> True
  3. Belgeyi yükleyen kullanıcı -> True
  4. Chat ek belgesi -> kullanıcı thread participant'ı olmalı
  5. Görev ek belgesi -> kullanıcı assigned_to / created_by / superuser
  6. Domain modülü ekleri (finance / pruva / properties / guarantees / integrators)
     -> can_write yetkisi olan kullanıcı (muhasebeci dahil) erişebilir
  7. Diğer her durumda -> False (güvenli default)

Bu helper sadece read/download yetkisi içindir; mutate yetkisi finance.permissions
üzerinden ayrıdır.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from apps.finance.permissions import can_write

if TYPE_CHECKING:
    from .models import Document


HIGH_ROLES = {"super_admin", "yonetici", "muhasebe_muduru"}

# can_write yetkisi olan kullanıcıların erişebileceği domain app'leri
DOMAIN_APPS_FOR_WRITE_USERS = {
    "finance", "pruva", "properties", "guarantees",
    "integrators", "subscriptions", "regular_payments",
    "official_payments",
}


def _user_groups(user) -> set[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return set()
    return set(user.groups.values_list("name", flat=True))


def _is_high_role(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return bool(HIGH_ROLES & _user_groups(user))


# ---- per-attachment-type checks --------------------------------------------


def _user_in_chat_thread_for_doc(user, document) -> bool:
    """Belge bir ChatAttachment ise kullanıcı thread'in aktif participant'ı mı?"""
    try:
        from apps.chat.models import ChatAttachment, ChatParticipant
    except Exception:
        return False
    att_qs = ChatAttachment.objects.filter(document=document).select_related("message__thread")
    for att in att_qs:
        thread = getattr(att.message, "thread", None)
        if thread is None:
            continue
        if ChatParticipant.objects.filter(
            thread=thread, user=user, is_active=True
        ).exists():
            return True
    return False


def _user_owns_task_for_doc(user, document) -> bool:
    """Belge bir TaskAttachment ise kullanıcı görevin assignee/creator'ı mı?"""
    try:
        from apps.tasks.models import TaskAttachment
    except Exception:
        return False
    att_qs = TaskAttachment.objects.filter(document=document).select_related("task")
    for att in att_qs:
        t = att.task
        if t is None:
            continue
        if getattr(t, "assigned_to_id", None) == user.id:
            return True
        if getattr(t, "created_by_id", None) == user.id:
            return True
    return False


def _doc_belongs_to_writable_domain(document) -> bool:
    """Belge, can_write rolünün erişebileceği domain modüllerinden birinde
    referans alınmış mı? Hem `related_app` alanı hem de bilinen ara tablolar
    (PayableDocument, StatementDocument, vs.) kontrol edilir."""
    related_app = (document.related_app or "").lower()
    if related_app in DOMAIN_APPS_FOR_WRITE_USERS:
        return True

    # Reverse FK kontrolleri — belge bir domain ara tablosuna bağlı mı?
    related_names = (
        "payable_links",          # finance.PayableDocument
        "statement_documents",    # pruva
        "site_documents",         # pruva
        "aidat_difference_documents",  # pruva
        "property_tax_documents", # properties
        "guarantee_documents",    # guarantees
        "integrator_documents",   # integrators
    )
    for rn in related_names:
        mgr = getattr(document, rn, None)
        if mgr is not None:
            try:
                if mgr.exists():
                    return True
            except Exception:
                continue
    return False


# ---- public API ------------------------------------------------------------


def can_download_document(user, document: "Document") -> bool:
    """Object-level download yetkisi.

    Returns:
        True  → indirme serbest
        False → 403
    """
    if document is None:
        return False
    if not user or not getattr(user, "is_authenticated", False):
        return False

    # 1. Yüksek rol / superuser
    if _is_high_role(user):
        return True

    # 2. Yükleyen kullanıcı
    if document.uploaded_by_id and document.uploaded_by_id == user.id:
        return True

    # 3. Chat ek belgesi
    if _user_in_chat_thread_for_doc(user, document):
        return True

    # 4. Görev ek belgesi
    if _user_owns_task_for_doc(user, document):
        return True

    # 5. Domain modülü belgesi + can_write yetkisi
    if can_write(user) and _doc_belongs_to_writable_domain(document):
        return True

    # 6. Default deny
    return False
