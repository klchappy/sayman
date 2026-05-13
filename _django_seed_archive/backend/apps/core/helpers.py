"""TR locale helper'ları — para, tarih, maskeleme."""
from decimal import Decimal


def format_money_tr(value) -> str:
    """₺ 1.234,56 formatı."""
    if value is None:
        return "—"
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    s = f"{value:,.2f}"
    # Default İngilizce: 1,234.56 → TR: 1.234,56
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"₺ {s}"


def mask_tc(tc: str) -> str:
    """TC No: ilk 3 + son 4 görünür, ortası ***."""
    if not tc or len(tc) != 11:
        return "***"
    return f"{tc[:3]}***{tc[-4:]}"


def mask_phone(phone: str) -> str:
    """Telefon: son 4 görünür."""
    if not phone:
        return "***"
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) < 4:
        return "***"
    return f"***{digits[-4:]}"
