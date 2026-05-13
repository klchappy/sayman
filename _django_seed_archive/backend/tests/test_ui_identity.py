"""
UI Identity Reset — Seed Design V2 kimliği için template/CSS sözleşme testleri.

Bu test seti, canlı UI dosyalarında (templates/, static/) Faz 1–9 boyunca
oluşmuş eski marka çağrışımlarının (Acme / KE / HES / SiteX / üretim …)
ve yasak font/dark-mode referanslarının bulunmadığını doğrular.

Domain modeli, migration, servis logic'i değişmedi — bu yalnız UI sözleşmesi.
"""
import re
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

User = get_user_model()
BACKEND_DIR = Path(__file__).resolve().parent.parent
TPL_DIR = BACKEND_DIR / "templates"
APPS_DIR = BACKEND_DIR / "apps"
CSS_PATH = BACKEND_DIR / "static" / "css" / "app.css"

# Yasak terimler — aktif UI dosyalarında geçmemeli.
# Eski enerji/üretim çağrışımları + eski SiteX metni.
FORBIDDEN_TERMS = [
    "Acme", "ACME",
    "Yenice", "Kısık", "Santral",
    " HES ",
    "enerji santrali",
    "Pruva", "SiteX", "pruva34",
    "üretim",
]


def _iter_active_ui_files():
    """Canlı UI dosyaları: project templates/ + her app altındaki templates/ + static CSS."""
    for p in TPL_DIR.rglob("*.html"):
        yield p
    for p in APPS_DIR.rglob("templates/*.html"):
        yield p
    for p in APPS_DIR.rglob("templates/**/*.html"):
        yield p
    yield CSS_PATH


class ForbiddenTermsTest(TestCase):
    """Aktif UI dosyalarında yasaklı kelimeler bulunmamalı."""

    def test_forbidden_terms_absent(self):
        offenders = []
        for path in _iter_active_ui_files():
            try:
                content = path.read_text(encoding="utf-8")
            except Exception:
                continue
            for term in FORBIDDEN_TERMS:
                if term in content:
                    offenders.append(f"{path.name}: '{term.strip()}'")
        self.assertFalse(
            offenders,
            "Aktif UI dosyalarında yasak kelime bulundu:\n" + "\n".join(offenders),
        )


class CssDesignContractTest(TestCase):
    """app.css — IBM Plex var, Inter/JetBrains/dark-mode yok."""

    def setUp(self):
        self.css = CSS_PATH.read_text(encoding="utf-8")
        self.css_no_comments = re.sub(r"/\*.*?\*/", "", self.css, flags=re.DOTALL)

    def test_ibm_plex_present(self):
        self.assertIn("IBM Plex Sans", self.css)
        self.assertIn("IBM Plex Mono", self.css)

    def test_no_inter_font(self):
        self.assertIsNone(
            re.search(r"font-family[^;]*\bInter\b", self.css_no_comments, re.IGNORECASE),
            "'Inter' font yasak (DESIGN_FREEZE)",
        )

    def test_no_jetbrains_font(self):
        self.assertNotIn("JetBrains", self.css_no_comments)
        self.assertNotIn("jetbrains", self.css_no_comments.lower())

    def test_no_active_dark_mode_rule(self):
        self.assertNotIn(
            "prefers-color-scheme: dark",
            self.css_no_comments.lower(),
            "Aktif CSS'te dark mode rule'u yasak (Anayasa 11.1)",
        )


class IdentityRenderedTest(TestCase):
    """OPS kimliği dashboard cevabında render olmalı."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("ui_identity", password="pw_xyz123")

    def setUp(self):
        self.client = Client()
        self.client.force_login(self.user)

    def test_dashboard_contains_slc_monogram(self):
        res = self.client.get(reverse("dashboard:home"))
        self.assertEqual(res.status_code, 200)
        body = res.content.decode("utf-8")
        self.assertIn("OPS", body)

    def test_dashboard_contains_product_name(self):
        res = self.client.get(reverse("dashboard:home"))
        self.assertIn("Muhasebe Operasyonları Takip Sistemi", res.content.decode("utf-8"))

    def test_dashboard_contains_operasyon_merkezi(self):
        res = self.client.get(reverse("dashboard:home"))
        self.assertIn("OPERASYON MERKEZİ", res.content.decode("utf-8"))

    def test_sidebar_contains_site_aidatlari(self):
        res = self.client.get(reverse("dashboard:home"))
        self.assertIn("Site Aidatları", res.content.decode("utf-8"))

    def test_sidebar_does_not_contain_pruva(self):
        res = self.client.get(reverse("dashboard:home"))
        body = res.content.decode("utf-8")
        # Sidebar/dashboard rendered HTML — eski "Pruva" kelimesi kalmadı
        self.assertNotIn("Pruva", body)

    def test_sidebar_keeps_required_urls(self):
        """Önceki testlerin beklediği URL anchor'ları korunuyor."""
        res = self.client.get(reverse("dashboard:home"))
        body = res.content.decode("utf-8")
        for href in [
            'href="/subscriptions/"',
            'href="/regular-payments/"',
            'href="/official-payments/"',
            "/guarantees/",
            "/integrators/",
            "/pruva/",  # URL namespace değişmedi, label değişti
        ]:
            self.assertIn(href, body, f"{href} sidebar'da bulunamadı")
