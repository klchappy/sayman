"""
6 Rol tanımı — PHASE1_PERMISSION_AUTH_PLAN.md Bölüm 2.
Anayasa Madde 4.

Bu dosya rol isimlerinin TEK kaynak gerçeğidir. seed_roles command ve
permission helper bunu okur.
"""
from typing import NamedTuple


class RoleSpec(NamedTuple):
    code: str
    name: str
    description: str


ROLES: list[RoleSpec] = [
    RoleSpec("super_admin", "Super Admin",
             "Sistem yönetimi, yetki atama, hard-delete, Telegram gerçek konfig"),
    RoleSpec("yonetici", "Yönetici",
             "Tüm modüller, son onay, raporlar"),
    RoleSpec("muhasebe_muduru", "Muhasebe Müdürü",
             "Tüm operasyonel modüller, görev atama, import onay"),
    RoleSpec("muhasebeci", "Muhasebeci",
             "Atanan modüllerde işlem, ödeme işaretleme, dekont yükleme"),
    RoleSpec("personel", "Personel",
             "Atanan görevler + sınırlı kayıt erişim"),
    RoleSpec("goruntuleyici", "Görüntüleyici",
             "Read-only, raporlar"),
]

ROLE_CODES = [r.code for r in ROLES]
