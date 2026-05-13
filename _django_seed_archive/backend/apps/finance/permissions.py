"""Finance role helpers — PHASE1_PERMISSION_AUTH_PLAN.md Bölüm 5."""

WRITE_ROLES = {"super_admin", "yonetici", "muhasebe_muduru", "muhasebeci"}
APPROVE_ROLES = {"super_admin", "yonetici", "muhasebe_muduru"}
READ_ONLY_ROLES = {"personel", "goruntuleyici"}


def _user_groups(user) -> set[str]:
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        return WRITE_ROLES | APPROVE_ROLES
    return set(user.groups.values_list("name", flat=True))


def can_write(user) -> bool:
    return bool(WRITE_ROLES & _user_groups(user))


def can_approve(user) -> bool:
    return bool(APPROVE_ROLES & _user_groups(user))
