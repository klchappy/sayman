#!/usr/bin/env python
"""SAYMAN — Multi-Tenant Muhasebe Operasyon SaaS — Django manage.py"""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django import edilemedi. Sanal ortam aktif mi? Bağımlılıklar yüklü mü?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
