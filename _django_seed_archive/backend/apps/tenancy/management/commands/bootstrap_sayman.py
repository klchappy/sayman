"""
bootstrap_sayman — İlk Organization + 7 sektör tenant'ı seed.

Kullanım:
    python manage.py bootstrap_sayman \
        --org-name "Kılıç Holding" \
        --org-slug kilic \
        --base-domain localhost

Bu komut:
  1. Public schema'da PUBLIC tenant'ı (yoksa) yaratır
  2. Verilen Organization'ı yaratır
  3. 7 sektör için TenantSchema kayıtları yaratır (her biri için Postgres schema)
  4. Her tenant için subdomain (örn. tekstil.kilic.localhost) ekler

NOT: Bu komut public schema'da `manage.py migrate_schemas --shared` sonrası
çalıştırılmalıdır.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.tenancy.models import Domain, Organization, Sector, TenantSchema


SECTORS_TO_SEED = [
    (Sector.TEKSTIL,     "tekstil",     "{org_name} Tekstil"),
    (Sector.ENERJI,      "enerji",      "{org_name} Enerji"),
    (Sector.INSAAT,      "insaat",      "{org_name} İnşaat"),
    (Sector.GAYRIMENKUL, "gayrimenkul", "{org_name} Gayrimenkul"),
    (Sector.KISISEL,     "kisisel",     "{org_name} Kişisel / Aile"),
    (Sector.SANAYI,      "sanayi",      "{org_name} Sanayi"),
    (Sector.HUKUK,       "hukuk",       "{org_name} Hukuk"),
]


class Command(BaseCommand):
    help = "İlk Organization + 7 sektör tenant'ı seed (Sayman bootstrap)."

    def add_arguments(self, parser):
        parser.add_argument("--org-name", required=True, help="Organizasyon adı (örn. 'Kılıç Holding')")
        parser.add_argument("--org-slug", required=True, help="Organizasyon slug (örn. 'kilic')")
        parser.add_argument(
            "--base-domain", default="localhost",
            help="Subdomain base (örn. 'localhost' veya 'sayman.deploi.net')",
        )
        parser.add_argument(
            "--ensure-public", action="store_true",
            help="Public tenant'ı (yoksa) otomatik yarat",
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        org_name = opts["org_name"]
        org_slug = opts["org_slug"]
        base_domain = opts["base_domain"]

        if opts.get("ensure_public"):
            self._ensure_public_tenant(base_domain)

        org, created = Organization.objects.get_or_create(
            slug=org_slug,
            defaults={"name": org_name},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"+ Organization: {org}"))
        else:
            self.stdout.write(self.style.WARNING(f"~ Organization mevcut: {org}"))

        for sector, slug, name_tmpl in SECTORS_TO_SEED:
            tenant, t_created = TenantSchema.objects.get_or_create(
                organization=org,
                slug=slug,
                defaults={
                    "name": name_tmpl.format(org_name=org_name),
                    "sector": sector,
                },
            )
            tag = "+" if t_created else "~"
            self.stdout.write(f"  {tag} {tenant} (schema={tenant.schema_name})")

            domain_str = f"{slug}.{org_slug}.{base_domain}"
            domain, d_created = Domain.objects.get_or_create(
                domain=domain_str,
                defaults={"tenant": tenant, "is_primary": True},
            )
            tag = "+" if d_created else "~"
            self.stdout.write(f"      {tag} domain={domain_str}")

        self.stdout.write(self.style.SUCCESS(
            f"\nDONE — Organization '{org_name}' altında {len(SECTORS_TO_SEED)} tenant kuruldu."
        ))
        self.stdout.write(
            "Sonraki adım: tenant şemalarına migrate_schemas (tenant-app migration'ları)."
        )

    def _ensure_public_tenant(self, base_domain: str) -> None:
        """
        django-tenants public schema için tek bir TenantSchema kaydı gerektirir
        (PUBLIC_SCHEMA_NAME=public). Bu kayıt sistem geneline aittir; herhangi
        bir Organization'a bağlı değildir.

        Public Organization yoksa "sayman-system" slug'lu bir tane yaratılır;
        public TenantSchema buna bağlanır.

        Önemli: public schema PostgreSQL'de zaten vardır; auto_create_schema'yı
        instance bazında False'a çekip save() çağırıyoruz, böylece
        django-tenants tekrar yaratmaya çalışmaz.
        """
        sys_org, _ = Organization.objects.get_or_create(
            slug="sayman-system",
            defaults={"name": "Sayman Sistem"},
        )

        try:
            public_tenant = TenantSchema.objects.get(schema_name="public")
        except TenantSchema.DoesNotExist:
            public_tenant = TenantSchema(
                organization=sys_org,
                slug="public",
                name="Public (Sistem)",
                sector=Sector.DIGER,
                schema_name="public",
            )
            # Instance-level override (class-level True default'unu bypass)
            public_tenant.auto_create_schema = False
            public_tenant.save()
            self.stdout.write(self.style.SUCCESS("+ Public tenant kaydı oluşturuldu"))

        Domain.objects.get_or_create(
            domain=base_domain,
            defaults={"tenant": public_tenant, "is_primary": True},
        )
