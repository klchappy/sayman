"""Template context processors."""
from django.conf import settings


def brand_context(request):
    return {
        "BRAND": settings.BRAND,
        "BRAND_NAME": settings.BRAND["name"],
    }
