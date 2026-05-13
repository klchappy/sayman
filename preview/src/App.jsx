import React from "react";

/* ============================================================
   MUHASEBE OPERASYON SİSTEMİ — Sprint 1A Canvas
   Light-only · Lacivert + altın · TR locale
   ============================================================ */

/* --- Canvas wrapper altyapısı ---------------------------------- */
function DesignCanvas({ children }) {
  return (
    <div
      style={{
        background: "#EEF1F5",
        minHeight: "100vh",
        padding: 32,
        fontFamily:
          "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        color: "#1A1A1A",
      }}
    >
      {children}
    </div>
  );
}

function DCSection({ id, title, children }) {
  return (
    <section id={id} style={{ marginBottom: 56 }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#0F2540",
          marginBottom: 20,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
        {children}
      </div>
    </section>
  );
}

function DCArtboard({ id, label, width = 1440, height = 900, children }) {
  return (
    <div id={id} style={{ width: width + 24, marginBottom: 12 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#4B5563",
          marginBottom: 10,
          paddingLeft: 4,
        }}
      >
        {label} <span style={{ color: "#9CA3AF", fontWeight: 500 }}>· {width}×{height}</span>
      </div>
      <div
        style={{
          width,
          height,
          background: "#F8F9FA",
          border: "1px solid #E5E7EB",
          borderRadius: 16,
          boxShadow: "0 6px 16px rgba(15,37,64,0.08)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   Tasarım tokenları
   ============================================================ */
const T = {
  brand900: "#0F2540",
  brand700: "#1E3A5F",
  brand500: "#3B5F8A",
  brand300: "#A8BBD3",
  brand100: "#E8EEF6",
  accent500: "#D4A93C",
  accent100: "#FAF1D6",
  bg: "#F8F9FA",
  card: "#FFFFFF",
  border: "#E5E7EB",
  ink: "#1A1A1A",
  ink2: "#4B5563",
  muted: "#9CA3AF",
  success500: "#16A34A",
  success100: "#DCFCE7",
  warning500: "#F59E0B",
  warning100: "#FEF3C7",
  danger500: "#DC2626",
  danger100: "#FEE2E2",
  info500: "#2563EB",
  info100: "#DBEAFE",
  orange500: "#F97316",
  orange100: "#FFEDD5",
  purple500: "#7C3AED",
  purple100: "#EDE9FE",
};

/* ============================================================
   Mini-component yardımcıları
   ============================================================ */
function StatusTag({ label, bg, fg, dot, pulse }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 10px",
        borderRadius: 9999,
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 9999,
          background: dot || fg,
          boxShadow: pulse ? `0 0 0 3px ${bg}` : "none",
        }}
      />
      {label}
    </span>
  );
}

function Btn({ children, variant = "primary", size = "md", style }) {
  const sizes = {
    sm: { h: 32, px: 12, fs: 12 },
    md: { h: 40, px: 16, fs: 13 },
    lg: { h: 48, px: 20, fs: 14 },
  };
  const v = sizes[size];
  const variants = {
    primary: { bg: T.brand700, fg: "#fff", bd: T.brand700 },
    secondary: { bg: "#fff", fg: T.brand700, bd: T.brand700 },
    ghost: { bg: "transparent", fg: T.ink2, bd: "transparent" },
    danger: { bg: T.danger500, fg: "#fff", bd: T.danger500 },
    success: { bg: T.success500, fg: "#fff", bd: T.success500 },
    accent: { bg: T.accent500, fg: T.brand900, bd: T.accent500 },
  };
  const c = variants[variant];
  return (
    <button
      style={{
        height: v.h,
        padding: `0 ${v.px}px`,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        borderRadius: 8,
        fontSize: v.fs,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Card({ children, style, pad = 20 }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: "0 2px 6px rgba(15,37,64,0.06)",
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: T.ink2,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Input({ value, placeholder, w = "100%" }) {
  return (
    <div
      style={{
        height: 40,
        width: w,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        background: "#fff",
        fontSize: 14,
        color: value ? T.ink : T.muted,
      }}
    >
      {value || placeholder}
    </div>
  );
}

function MoneyTR(n) {
  return "₺ " + n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Lucide-benzeri inline SVG ikonlar (sadece görsel) */
const Ico = {
  bell: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5v14" />
    </svg>
  ),
  msg: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  upload: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  file: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  ),
};

/* ============================================================
   FRAME 1 — 00 Design System
   ============================================================ */
function DesignSystemFrame() {
  const swatches = [
    ["brand-900", T.brand900], ["brand-700", T.brand700], ["brand-500", T.brand500],
    ["brand-300", T.brand300], ["brand-100", T.brand100], ["accent-500", T.accent500],
    ["accent-100", T.accent100], ["ink", T.ink], ["ink-2", T.ink2], ["muted", T.muted], ["border", T.border], ["bg", T.bg],
  ];
  const semantic = [
    ["success", T.success500, T.success100], ["warning", T.warning500, T.warning100],
    ["danger", T.danger500, T.danger100], ["info", T.info500, T.info100],
    ["orange", T.orange500, T.orange100], ["purple", T.purple500, T.purple100],
  ];
  const badges = [
    ["BEKLİYOR", T.warning100, T.warning500],
    ["YAKLAŞIYOR", T.orange100, T.orange500],
    ["GECİKTİ", T.danger100, T.danger500],
    ["ÖDENDİ", T.success100, T.success500],
    ["KONTROL GEREKLİ", T.purple100, T.purple500],
    ["TASLAK", T.info100, T.info500],
    ["ONAYLANDI", T.success100, T.success500],
    ["IMPORT BEKLİYOR", T.info100, T.info500],
    ["DEKONT EKSİK", T.orange100, T.orange500],
    ["FATURA EKSİK", T.orange100, T.orange500],
    ["KRİTİK", T.danger100, T.danger500],
    ["KONTÖR KRİTİK", T.danger100, T.danger500],
  ];

  return (
    <div style={{ padding: 28, overflowY: "auto", height: "100%" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.brand900 }}>Design System</div>
        <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>
          Light-only · Kurumsal lacivert + altın · WCAG AA · Locale TR
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* RENK PALETİ */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginBottom: 4 }}>Renk Paleti · Finans/ERP Çizgisi</div>
          <div style={{ fontSize: 11, color: T.ink2, marginBottom: 14 }}>Lacivert / indigo / beyaz / açık gri ana karakter · Altın yalnızca CTA & küçük accent</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Birincil — Lacivert/Indigo</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 14 }}>
            {[["brand-900", T.brand900], ["brand-700", T.brand700], ["brand-500", T.brand500], ["brand-300", T.brand300], ["brand-100", T.brand100]].map(([n, c]) => (
              <div key={n}>
                <div style={{ height: 56, background: c, border: `1px solid ${T.border}`, borderRadius: 8 }} />
                <div style={{ fontSize: 10, color: T.ink2, marginTop: 4, fontWeight: 600 }}>{n}</div>
                <div style={{ fontSize: 9, color: T.muted, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{c}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Nötr — Yüzey / Metin</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 14 }}>
            {[["bg", T.bg], ["card", T.card], ["border", T.border], ["ink-2", T.ink2], ["ink", T.ink]].map(([n, c]) => (
              <div key={n}>
                <div style={{ height: 40, background: c, border: `1px solid ${T.border}`, borderRadius: 6 }} />
                <div style={{ fontSize: 10, color: T.ink2, marginTop: 4, fontWeight: 600 }}>{n}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Altın · Sınırlı Vurgu</div>
          <div style={{ padding: 10, background: T.bg, borderRadius: 6, border: `1px solid ${T.border}`, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, background: T.accent500, borderRadius: 6 }} />
              <div style={{ width: 40, height: 40, background: T.accent100, borderRadius: 6, border: `1px solid ${T.border}` }} />
              <div style={{ flex: 1, fontSize: 10, color: T.ink2, lineHeight: 1.5 }}>
                <b style={{ color: T.brand900 }}>Sadece:</b> birincil CTA aksent, KPI ince çizgi, aktif menü vurgusu. Geniş alan dolgusu olarak kullanılmaz.
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Semantic — Yalnızca Status/Badge</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>
            {semantic.map(([n, c, b]) => (
              <div key={n}>
                <div style={{ height: 28, background: c, borderRadius: 6 }} />
                <div style={{ height: 14, background: b, borderRadius: 6, marginTop: 2 }} />
                <div style={{ fontSize: 9, color: T.ink2, marginTop: 4, fontWeight: 600 }}>{n}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* TİPOGRAFİ */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginBottom: 4 }}>Tipografi · IBM Plex Sans + IBM Plex Mono</div>
          <div style={{ fontSize: 11, color: T.ink2, marginBottom: 12 }}>Kurumsal finans/ERP çizgisi · TR karakter desteği · Mono = veri/sayı/referans alanları</div>
          <div style={{ fontSize: 28, lineHeight: "36px", fontWeight: 700, color: T.brand900 }}>H1 — Başlık 28/700</div>
          <div style={{ fontSize: 24, lineHeight: "32px", fontWeight: 700, color: T.brand900, marginTop: 6 }}>H2 — Başlık 24/700</div>
          <div style={{ fontSize: 20, lineHeight: "28px", fontWeight: 600, color: T.ink, marginTop: 6 }}>H3 — Alt başlık 20/600</div>
          <div style={{ fontSize: 18, lineHeight: "26px", fontWeight: 600, color: T.ink, marginTop: 6 }}>H4 — Kart başlık 18/600</div>
          <div style={{ fontSize: 16, lineHeight: "24px", color: T.ink, marginTop: 8 }}>Body-LG 16/400 — Mobil input zorunlu boyut.</div>
          <div style={{ fontSize: 14, lineHeight: "22px", color: T.ink, marginTop: 4 }}>Body 14/400 — Standart metin.</div>
          <div style={{ fontSize: 13, lineHeight: "20px", color: T.ink2, marginTop: 4 }}>Body-SM 13/400 — Tablo hücreleri.</div>
          <div style={{ fontSize: 12, lineHeight: "18px", color: T.ink2, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>CAPTION 12/600 · ETİKET</div>
          <div style={{ marginTop: 14, padding: 10, background: T.bg, borderRadius: 6, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, color: T.ink2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>IBM Plex Mono — Veri Alanları</div>
            <div style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: T.brand900, lineHeight: 1.7 }}>
              ₺ 28.344,50 · ₺ 1.234,56<br />
              20.05.2026 · 31.12.2026<br />
              71-D8-3842 · 1899409819<br />
              A4.17 · B2.28 · 2026-D1
            </div>
          </div>
        </Card>

        {/* BUTONLAR */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginBottom: 14 }}>Butonlar</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn variant="primary">Kaydet</Btn>
            <Btn variant="secondary">İptal</Btn>
            <Btn variant="success">Onayla</Btn>
            <Btn variant="danger">Reddet</Btn>
            <Btn variant="accent">Hızlı Oluştur</Btn>
            <Btn variant="ghost">Vazgeç</Btn>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <Btn size="sm">Küçük</Btn>
            <Btn size="md">Orta</Btn>
            <Btn size="lg">Büyük</Btn>
            <Btn variant="primary" size="md">{Ico.plus} Yeni Fatura</Btn>
          </div>
        </Card>

        {/* INPUT */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginBottom: 14 }}>Form Alanları</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel>Şirket *</FieldLabel>
              <Input value="Acme Tekstil San. Ltd. Şti." />
            </div>
            <div>
              <FieldLabel>Son Ödeme Tarihi</FieldLabel>
              <Input value="20.05.2026" />
            </div>
            <div>
              <FieldLabel>Tutar</FieldLabel>
              <Input value={MoneyTR(28344.50)} />
            </div>
            <div>
              <FieldLabel>Banka</FieldLabel>
              <Input placeholder="Banka seçin..." />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <FieldLabel>Açıklama</FieldLabel>
              <div style={{ height: 72, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, fontSize: 14, color: T.muted, background: "#fff" }}>
                Açıklama yazın...
              </div>
            </div>
          </div>
        </Card>

        {/* STATUS BADGE */}
        <Card style={{ gridColumn: "span 2" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginBottom: 14 }}>Status Badge Sistemi</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {badges.map(([l, bg, fg]) => (
              <StatusTag key={l} label={l} bg={bg} fg={fg} pulse={l === "KRİTİK" || l === "KONTÖR KRİTİK"} />
            ))}
          </div>
        </Card>

        {/* KPI + RISK */}
        <Card pad={0}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.brand900 }}>KPI Card</div>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Bugün Ödenecek</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: T.brand900, marginTop: 8, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{MoneyTR(48750.25)}</div>
            <div style={{ fontSize: 12, color: T.success500, marginTop: 4, fontWeight: 600 }}>↑ %8 dünden · 12 kalem</div>
          </div>
        </Card>
        <Card pad={0} style={{ borderLeft: `4px solid ${T.danger500}` }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.danger500 }}>Risk Card</div>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>Kontör eşik altı: 3 entegratör</div>
            <div style={{ fontSize: 12, color: T.ink2, marginTop: 6 }}>Papinet, EDM ve ETA hesaplarında kontör 500 altında. Yenileme gerekiyor.</div>
            <div style={{ marginTop: 12 }}><Btn variant="secondary" size="sm">Detay göster →</Btn></div>
          </div>
        </Card>

        {/* FILTER BAR */}
        <Card style={{ gridColumn: "span 2" }} pad={14}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", flex: 1, minWidth: 240, color: T.muted }}>
              {Ico.search}<span style={{ fontSize: 13 }}>Fatura, ödeme, kurum ara...</span>
            </div>
            <div style={{ height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 13, color: T.ink2 }}>Şirket: Tümü ▾</div>
            <div style={{ height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 13, color: T.ink2 }}>Dönem: 2026 ▾</div>
            <div style={{ height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 13, color: T.ink2 }}>Durum: Bekliyor ▾</div>
            <Btn variant="ghost" size="sm">Filtreleri temizle</Btn>
          </div>
        </Card>

        {/* TABLE ROW */}
        <Card style={{ gridColumn: "span 2" }} pad={0}>
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.brand900 }}>Tablo Satırı</div>
          <div style={{ background: T.brand100, padding: "10px 20px", display: "grid", gridTemplateColumns: "120px 1fr 140px 140px 140px 110px", gap: 12, fontSize: 11, fontWeight: 700, color: T.brand700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <div>Fatura No</div><div>Kurum / Açıklama</div><div>Son Ödeme</div><div style={{ textAlign: "right" }}>Tutar</div><div>Durum</div><div>Yöntem</div>
          </div>
          {[
            { no: "TT-2026-0419", k: "Türk Telekom · Ev İnternet 1899409819", t: "20.05.2026", a: 683.6, s: "BEKLİYOR", sb: T.warning100, sf: T.warning500, y: "OTOMATİK", yb: T.info100, yf: T.info500 },
            { no: "CK-2026-0331", k: "CK Boğaziçi · Florya Ev Elektrik", t: "15.05.2026", a: 3630, s: "ÖDENDİ", sb: T.success100, sf: T.success500, y: "EFT", yb: T.success100, yf: T.success500 },
            { no: "PRV-A4.17", k: "SiteX · A4.17 Aidat 2026-04", t: "20.04.2026", a: 28344, s: "GECİKTİ", sb: T.danger100, sf: T.danger500, y: "ELDEN", yb: T.warning100, yf: T.warning500 },
          ].map((r, i) => (
            <div key={i} style={{ padding: "12px 20px", display: "grid", gridTemplateColumns: "120px 1fr 140px 140px 140px 110px", gap: 12, alignItems: "center", borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.ink }}>
              <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12 }}>{r.no}</div>
              <div>{r.k}</div>
              <div>{r.t}</div>
              <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 600 }}>{MoneyTR(r.a)}</div>
              <div><StatusTag label={r.s} bg={r.sb} fg={r.sf} /></div>
              <div><StatusTag label={r.y} bg={r.yb} fg={r.yf} /></div>
            </div>
          ))}
        </Card>

        {/* MOBILE CARD + CHAT BUBBLE + MODAL + EMPTY */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginBottom: 14 }}>Mobile Kart + Chat Bubble</div>
          <div style={{ width: 280, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Türk Telekom</div>
              <StatusTag label="BEKLİYOR" bg={T.warning100} fg={T.warning500} />
            </div>
            <div style={{ fontSize: 12, color: T.ink2, marginTop: 4 }}>Ev İnternet · 1899409819</div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: T.ink2 }}>20.05.2026</span>
              <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: T.brand900 }}>{MoneyTR(683.60)}</span>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "inline-block", maxWidth: 240, padding: "8px 12px", background: T.neutral100 || "#F1F3F5", color: T.ink, borderRadius: "12px 12px 12px 4px", fontSize: 13 }}>
              SiteX A4.17 ekstresini yükledim, kontrol eder misin?
            </div>
            <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
              <div style={{ display: "inline-block", maxWidth: 240, padding: "8px 12px", background: T.brand100, color: T.brand900, borderRadius: "12px 12px 4px 12px", fontSize: 13 }}>
                Bakıyorum, aidat farkı 1.864 TL — mutabakat görevini açıyorum. ✓✓
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginBottom: 14 }}>Modal · Empty State</div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, background: "#fff", boxShadow: "0 6px 16px rgba(15,37,64,0.10)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.brand900 }}>Ödemeyi onayla</div>
            <div style={{ fontSize: 13, color: T.ink2, marginTop: 6 }}>3 satır kesin kayda dönüştürülecek. Bu işlem audit'lenir.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <Btn variant="secondary" size="sm">İptal</Btn>
              <Btn variant="primary" size="sm">Onayla</Btn>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: 24, textAlign: "center", border: `1px dashed ${T.border}`, borderRadius: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 9999, background: T.brand100, color: T.brand500, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{Ico.file}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginTop: 10 }}>Henüz fatura yok</div>
            <div style={{ fontSize: 12, color: T.ink2, marginTop: 4 }}>İlk faturayı ekleyin veya import başlatın.</div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
              <Btn variant="primary" size="sm">+ Fatura</Btn>
              <Btn variant="secondary" size="sm">Import</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   App Shell — Topbar + SideNav (paylaşılan)
   ============================================================ */
function TopBar() {
  return (
    <div style={{ height: 56, background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.brand700, color: T.accent500, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>K</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900 }}>Acme Muhasebe Operasyon</div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ height: 36, width: 320, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0 12px", display: "flex", alignItems: "center", gap: 8, color: T.muted, background: T.bg, fontSize: 13 }}>
        {Ico.search}<span>Ara... </span>
        <div style={{ marginLeft: "auto", padding: "2px 6px", border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 11, color: T.ink2, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>⌘K</div>
      </div>
      <Btn variant="accent" size="sm">{Ico.plus}<span>Hızlı Oluştur</span></Btn>
      <div style={{ position: "relative", width: 36, height: 36, borderRadius: 8, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.ink2, background: "#fff" }}>
        {Ico.bell}
        <div style={{ position: "absolute", top: -4, right: -4, height: 18, minWidth: 18, padding: "0 5px", background: T.danger500, color: "#fff", borderRadius: 9999, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>5</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9999, background: T.brand500, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>AY</div>
        <div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>Ayşe</div>
      </div>
    </div>
  );
}

function SideNav({ active = "dashboard" }) {
  const groups = [
    { title: "OPERASYON", items: [["dashboard", "Dashboard", "📊"], ["fatura", "Fatura", "🧾"], ["odeme", "Ödeme", "💳"], ["abonelik", "Abonelik & Taahhüt", "📡"], ["import", "Import Merkezi", "⬆"], ["ajanda", "Ajanda & Görev", "📅"]] },
    { title: "MÜLK & ŞAHIS", items: [["pruva", "SiteX", "🏢"], ["emlak", "Emlak Vergisi", "🏛"], ["sahis", "Şahıslar", "👤"]] },
    { title: "ŞİRKET", items: [["sirket", "Şirketler", "🏭"], ["kira", "Kira", "🔑"], ["entegrator", "Entegratör/Kontör", "⚡"]] },
    { title: "RESMİ & BANKA", items: [["resmi", "Resmi Ödemeler", "🏦"], ["teminat", "Teminat Mektupları", "📜"], ["banka", "Bankalar", "💼"]] },
    { title: "SİSTEM", items: [["bildirim", "Bildirim/Telegram", "🔔"], ["rapor", "Raporlama", "📈"], ["audit", "AuditLog", "🛡"], ["yetki", "Yetki & Kullanıcı", "👥"]] },
  ];
  return (
    <div style={{ width: 240, background: T.card, borderRight: `1px solid ${T.border}`, padding: "16px 12px", overflowY: "auto" }}>
      {groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px 8px" }}>{g.title}</div>
          {g.items.map(([k, l, ic]) => (
            <div key={k} style={{ height: 36, padding: "0 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, marginBottom: 2, background: active === k ? T.brand100 : "transparent", color: active === k ? T.brand700 : T.ink, fontSize: 13, fontWeight: active === k ? 600 : 500, cursor: "pointer" }}>
              <span style={{ fontSize: 14, opacity: 0.85 }}>{ic}</span>
              <span>{l}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ChatWidgetCollapsed() {
  return (
    <div style={{ position: "absolute", right: 20, bottom: 20, width: 56, height: 56, borderRadius: 9999, background: T.brand700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 32px rgba(15,37,64,0.16)", cursor: "pointer" }}>
      {Ico.msg}
      <div style={{ position: "absolute", top: -2, right: -2, width: 20, height: 20, borderRadius: 9999, background: T.danger500, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>3</div>
    </div>
  );
}

/* ============================================================
   FRAME 2 — 01 App Shell
   ============================================================ */
function AppShellFrame() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="dashboard" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Operasyon / Dashboard</div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Sayfa Başlığı Alanı</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>5 Mayıs 2026 Salı · Bugün ne yapacaksınız?</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="secondary" size="md">Excel'e aktar</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Fatura</Btn>
            </div>
          </div>

          <div style={{ marginTop: 24, padding: 24, border: `2px dashed ${T.border}`, borderRadius: 12, background: T.card, color: T.muted, fontSize: 14, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink2 }}>İçerik alanı (sayfa render bölgesi)</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Bu bölge ilgili modüle göre Dashboard, Liste, Detay, Form veya Import ekranını render eder.</div>
          </div>

          <div style={{ marginTop: 24, fontSize: 11, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Topbar bileşenleri</div>
          <div style={{ marginTop: 8, padding: 16, border: `1px solid ${T.border}`, borderRadius: 12, background: "#fff", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, fontSize: 12, color: T.ink2 }}>
            <div><b style={{ color: T.brand900 }}>⌘K Arama</b><br />Global hızlı arama. Klavye kısayolu.</div>
            <div><b style={{ color: T.brand900 }}>Bildirim Zili</b><br />Okunmamış sayısı + dropdown.</div>
            <div><b style={{ color: T.brand900 }}>Hızlı Oluştur</b><br />+ Fatura, Ödeme, Görev, Mesaj.</div>
            <div><b style={{ color: T.brand900 }}>Kullanıcı Menüsü</b><br />Profil, ayarlar, çıkış.</div>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 3 — 02 Dashboard
   ============================================================ */
function DashboardFrame() {
  const kpis = [
    { l: "Bugün Ödenecek", v: MoneyTR(48750.25), d: "12 kalem · ↑ %8 düne göre", c: T.brand900 },
    { l: "Bu Ay Geciken", v: MoneyTR(112430.0), d: "7 kalem geciken", c: T.danger500 },
    { l: "Görev Tamamlanma", v: "%72", d: "18 / 25 görev", c: T.success500, bar: 72 },
    { l: "Eksik Dekont", v: "9", d: "5.000 TL üzeri kalemlerde", c: T.orange500 },
  ];
  const risks = [
    { l: "Kontör eşik altı", c: 3, d: "Papinet, EDM, ETA · <500 kontör", color: T.danger500 },
    { l: "Sözleşme bitişi yaklaşan", c: 4, d: "30 gün içinde 4 sözleşme", color: T.orange500 },
    { l: "Teminat komisyonu yaklaşan", c: 2, d: "Albaraka 71-D8-3833 + Garanti 1510023", color: T.orange500 },
    { l: "SiteX eksik ekstre", c: 1, d: "B3.31 — 2026-04 ekstresi yok", color: T.warning500 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="dashboard" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: 0 }}>Muhasebe Operasyon Merkezi</h1>
          <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>5 Mayıs 2026 · Bugün için 12 ödeme, 8 görev planlı.</div>

          {/* KPI ROW */}
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {kpis.map((k) => (
              <Card key={k.l}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: k.c, marginTop: 8, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{k.v}</div>
                {k.bar !== undefined && (
                  <div style={{ height: 6, background: T.border, borderRadius: 9999, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${k.bar}%`, background: T.success500 }} />
                  </div>
                )}
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 6 }}>{k.d}</div>
              </Card>
            ))}
          </div>

          {/* RISK ROW */}
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {risks.map((r) => (
              <Card key={r.l} style={{ borderLeft: `4px solid ${r.color}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: r.color, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{r.c}</div>
                </div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 6 }}>{r.d}</div>
                <div style={{ marginTop: 10 }}><Btn variant="secondary" size="sm">İncele →</Btn></div>
              </Card>
            ))}
          </div>

          {/* WIDGET GRID 2x4 */}
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {/* W1 */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900 }}>Bugünkü Görevlerim</div>
                <span style={{ fontSize: 11, color: T.muted }}>5 görev</span>
              </div>
              {[
                ["SiteX A4.17 ekstresini indir", "ACIL", T.danger500],
                ["İTO 1. taksit ödeme", "YÜKSEK", T.orange500],
                ["TEMİNAT 71-D8 komisyon", "NORMAL", T.info500],
                ["Eksik dekont yükle (3)", "NORMAL", T.info500],
              ].map(([t, p, c], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ width: 4, height: 28, background: c, borderRadius: 2 }} />
                  <div style={{ flex: 1, fontSize: 12, color: T.ink }}>{t}</div>
                  <span style={{ fontSize: 9, color: c, fontWeight: 700 }}>{p}</span>
                </div>
              ))}
              <div style={{ marginTop: 8 }}><Btn variant="ghost" size="sm">Tümünü gör →</Btn></div>
            </Card>

            {/* W2 */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>Yaklaşan Ödemeler (T-7)</div>
              {[
                ["Türk Telekom · Ev İnt.", "20.05", 683.6],
                ["CK Boğaziçi · Florya", "15.05", 3630],
                ["İGDAŞ · Doğalgaz", "18.05", 692.1],
                ["SiteX A4.22 Aidat", "22.05", 28344],
              ].map(([k, t, a], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none", fontSize: 12 }}>
                  <div style={{ color: T.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</div>
                  <div style={{ color: T.ink2, marginRight: 8 }}>{t}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: T.brand900 }}>{MoneyTR(a)}</div>
                </div>
              ))}
            </Card>

            {/* W3 — SiteX mini grid */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>SiteX · Bu Ay (Mayıs)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
                {[["A4.17", T.success500], ["A4.22", T.warning500], ["A4.25", T.success500], ["B2.28", T.danger500], ["B3.31", T.muted]].map(([d, c]) => (
                  <div key={d} style={{ aspectRatio: "1", borderRadius: 8, background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{d}</div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: T.ink2 }}>● Ödendi 2 · ● Yaklaşan 1 · ● Geciken 1 · ● Eksik 1</div>
              <div style={{ marginTop: 10 }}><Btn variant="ghost" size="sm">SiteX'e git →</Btn></div>
            </Card>

            {/* W4 — Import bekleyenler */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>Import Bekleyenler</div>
              {[
                ["EV ABONELİKLERİ.xlsx", "42 satır · 3 hata", T.warning500],
                ["SITEX_2026-04.rar", "10 PDF", T.info500],
                ["TEMİNAT.xlsx", "12 satır · OK", T.success500],
              ].map(([f, d, c], i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: i < 2 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>{f}</div>
                    <div style={{ width: 8, height: 8, borderRadius: 9999, background: c }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.ink2 }}>{d}</div>
                </div>
              ))}
              <div style={{ marginTop: 8 }}><Btn variant="primary" size="sm">Onaya devam</Btn></div>
            </Card>

            {/* W5 — Yaklaşan taahhüt */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>Yaklaşan Taahhüt Bitişi</div>
              {[
                ["TTNet · Yeniçe HES Internet", "14.02.2027", T.orange500],
                ["TTNet · Kısık Fiber 100", "14.02.2027", T.orange500],
                ["TT · Yeniçe Santral 0312-789", "28.04.2027", T.warning500],
              ].map(([k, t, c], i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: i < 2 ? `1px solid ${T.border}` : "none", fontSize: 12 }}>
                  <div style={{ color: T.ink, fontWeight: 600 }}>{k}</div>
                  <div style={{ color: c, fontSize: 11, marginTop: 2 }}>Bitiş: {t}</div>
                </div>
              ))}
            </Card>

            {/* W6 — Emlak yaklaşan */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>Emlak · Yaklaşan Taksit</div>
              <div style={{ fontSize: 11, color: T.ink2, marginBottom: 8 }}>1. Taksit son: 31.05.2026</div>
              {[
                ["Bayrampaşa Mega Center", 56172.6, "ÖDENMEDİ", T.danger500],
                ["Beyoğlu / MakYapı", 97191.6, "ÖDENMEDİ", T.danger500],
                ["Manisa Şehzadeler", 36160.85, "ÖDENDİ", T.success500],
              ].map(([k, a, s, c], i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: i < 2 ? `1px solid ${T.border}` : "none", fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ color: T.ink, fontWeight: 600 }}>{k}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: T.brand900, fontWeight: 700 }}>{MoneyTR(a)}</div>
                  </div>
                  <div style={{ color: c, fontSize: 10, marginTop: 2, fontWeight: 600 }}>{s}</div>
                </div>
              ))}
            </Card>

            {/* W7 — Son işlemler */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>Son İşlemler</div>
              {[
                ["Ayşe", "fatura ödedi", "TT-2026-0419", "12 dk"],
                ["Erdal", "import onayladı", "EV_ABONE.xlsx", "1 sa"],
                ["Müdür", "görev atadı", "SiteX mutabakat", "2 sa"],
                ["Melek", "dekont yükledi", "CK-2026-0331", "3 sa"],
              ].map(([u, e, k, t], i) => (
                <div key={i} style={{ padding: "6px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none", fontSize: 11, display: "flex", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: T.brand700 }}>{u}</span>
                  <span style={{ color: T.ink2 }}>{e}</span>
                  <span style={{ color: T.brand900, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{k}</span>
                  <span style={{ marginLeft: "auto", color: T.muted }}>{t}</span>
                </div>
              ))}
            </Card>

            {/* W8 — Bildirimler */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>Bildirimler</div>
              {[
                ["SiteX B2.28 ödeme T-3", T.warning500],
                ["Albaraka komisyon T-1", T.danger500],
                ["Yeni mesaj: @müdür", T.info500],
                ["Telegram dry-run hazır", T.muted],
              ].map(([t, c], i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 9999, background: c }} />
                  <div style={{ color: T.ink }}>{t}</div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 4 — 03 Import Center
   ============================================================ */
function ImportCenterFrame() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="import" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: 0 }}>Import Merkezi</h1>
          <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Excel · PDF · RAR · Klasör · Onaysız kesin kayıt yok.</div>

          {/* STEPPER */}
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 10 }}>
            {[
              ["1", "Dosya Yükle", true, true],
              ["2", "Mapping", true, false],
              ["3", "Önizleme & Onay", false, false],
            ].map(([n, l, active, done], i) => (
              <React.Fragment key={n}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9999, background: active ? T.brand700 : "#fff", color: active ? "#fff" : T.muted, border: `2px solid ${active ? T.brand700 : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{done ? "✓" : n}</div>
                  <div style={{ fontSize: 13, color: active ? T.brand900 : T.ink2, fontWeight: active ? 700 : 500 }}>{l}</div>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: T.border }} />}
              </React.Fragment>
            ))}
          </div>

          {/* ÜST FORM: kaynak + modül */}
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card>
              <FieldLabel>Kaynak Türü</FieldLabel>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {[
                  ["Excel", "📊", true], ["PDF", "📄", false], ["RAR", "🗜", false], ["Klasör", "📁", false],
                ].map(([t, ic, sel]) => (
                  <div key={t} style={{ flex: 1, padding: "12px 8px", border: `1.5px solid ${sel ? T.brand700 : T.border}`, borderRadius: 8, background: sel ? T.brand100 : "#fff", textAlign: "center", cursor: "pointer" }}>
                    <div style={{ fontSize: 20 }}>{ic}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: sel ? T.brand700 : T.ink, marginTop: 4 }}>{t}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <FieldLabel>Hedef Modül</FieldLabel>
              <Input value="Fatura / Ödeme — Şirket Abonelik" />
              <div style={{ fontSize: 11, color: T.ink2, marginTop: 6 }}>Sistem dosya yapısına göre <b>"EV ABONELİKLERİ kişi sheet v1"</b> mapping şablonunu önerdi.</div>
            </Card>
          </div>

          {/* DROP ZONE */}
          <div style={{ marginTop: 14, padding: "40px 20px", border: `2px dashed ${T.brand500}`, borderRadius: 12, background: T.brand100, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 9999, background: "#fff", color: T.brand700, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(15,37,64,0.06)" }}>{Ico.upload}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.brand900, marginTop: 12 }}>Dosyayı buraya sürükleyin veya tıklayarak seçin</div>
            <div style={{ fontSize: 12, color: T.ink2, marginTop: 4 }}>.xlsx, .xlsm, .pdf, .rar, .zip · Maks 100 MB</div>
            <div style={{ marginTop: 14 }}><Btn variant="primary" size="md">Dosya Seç</Btn></div>
          </div>

          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
            {/* SON IMPORTLAR */}
            <Card pad={0}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900 }}>Son Importlar</div>
                <Btn variant="ghost" size="sm">Tümünü gör →</Btn>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 90px 110px 140px 90px", gap: 10, padding: "10px 20px", background: T.brand100, fontSize: 11, fontWeight: 700, color: T.brand700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <div>Dosya</div><div>Modül</div><div>Satır</div><div>Hata</div><div>Durum</div><div>Tarih</div>
              </div>
              {[
                ["EV ABONELİKLERİ.xlsx", "Fatura · Şirket Abonelik", 42, 3, "ONAY BEKLİYOR", T.warning100, T.warning500, "05.05"],
                ["SITEX_2026-04.rar", "SiteX · Ekstre", 10, 0, "ÖNİZLEME", T.info100, T.info500, "04.05"],
                ["TEMİNAT.xlsx", "Teminat", 12, 0, "ONAYLANDI", T.success100, T.success500, "03.05"],
                ["EMLAK_2025.rar", "Emlak Vergisi", 14, 2, "KISMİ HATA", T.danger100, T.danger500, "02.05"],
                ["İTO_AIDAT.xlsx", "Resmi · İTO", 9, 0, "ONAYLANDI", T.success100, T.success500, "01.05"],
              ].map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 90px 110px 140px 90px", gap: 10, padding: "12px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 12, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.ink, fontWeight: 600 }}>{Ico.file} {r[0]}</div>
                  <div style={{ color: T.ink2 }}>{r[1]}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: T.ink }}>{r[2]}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: r[3] > 0 ? T.danger500 : T.muted, fontWeight: r[3] > 0 ? 700 : 400 }}>{r[3]}</div>
                  <div><StatusTag label={r[4]} bg={r[5]} fg={r[6]} /></div>
                  <div style={{ color: T.ink2, fontSize: 11 }}>{r[7]}.2026</div>
                </div>
              ))}
            </Card>

            {/* KONTROL BEKLEYEN TASLAKLAR */}
            <Card pad={0}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.brand900 }}>Kontrol Bekleyen Taslaklar</div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, color: T.ink2 }}>Yeşil (ok)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.success500, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>34</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, color: T.ink2 }}>Sarı (uyarı)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.warning500, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>3</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, color: T.ink2 }}>Mor (kontrol gerekli)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.purple500, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>2</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
                  <span style={{ fontSize: 12, color: T.ink2 }}>Kırmızı (hata)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.danger500, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>3</span>
                </div>
                <div style={{ marginTop: 12, padding: 12, background: T.danger100, borderRadius: 8, fontSize: 12, color: T.danger500, fontWeight: 600 }}>
                  ⚠ 3 hata düzeltilmeden commit yapılamaz.
                </div>
                <div style={{ marginTop: 12 }}><Btn variant="primary" size="md" style={{ width: "100%", justifyContent: "center" }}>Önizlemeye Git →</Btn></div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 5 — 04 Import Preview
   ============================================================ */
function ImportPreviewFrame() {
  const rows = [
    { sheet: "MEHMET RAHİM ACME", abon: "TÜRK TELEKOM · Ev Tel.", per: "2026-01", t: 187.0, status: "ok" },
    { sheet: "MEHMET RAHİM ACME", abon: "TTNet · İnternet 1899409819", per: "2026-01", t: 683.6, status: "ok" },
    { sheet: "ALİ ACME", abon: "CK Boğaziçi · Florya Elektrik", per: "2026-01", t: 3630.0, status: "ok" },
    { sheet: "ALİ ACME", abon: "SiteX A4.17 Aidat", per: "2026-01", t: 28344.0, status: "warning", note: "Tutar geçen aydan %0 değişti — kontrol önerilir." },
    { sheet: "SELÇUK ACME", abon: "SiteX B3.31 Aidat", per: "2026-01", t: 0, status: "danger", note: "Tutar boş. Excel hücresi 'X' işaretli — iptal mi?" },
    { sheet: "KAAN ACME", abon: "SiteX B2.28 Giderler", per: "2026-01", t: 1830.38, status: "ok" },
    { sheet: "MEHMET ALİ ACME", abon: "Yeni kurum: 'M.HÜRBAN ACME 0532...'", per: "2026-01", t: 729.0, status: "purple", note: "Yeni Sahis/Kurum tespiti. Manuel doğrulama gerekli." },
    { sheet: "MEHMET ALİ ACME", abon: "İGDAŞ · Doğalgaz 500200857270", per: "2026-01", t: 692.1, status: "ok" },
    { sheet: "ALİ ACME", abon: "Florya İSKİ ·.27833433", per: "2026-01", t: 569.0, status: "ok" },
    { sheet: "RENK APT", abon: "CK Elektrik 4898155977", per: "2026-01", t: null, status: "danger", note: "Tutar yok ve abonelik master'da kayıt bulunamadı." },
  ];

  const colorMap = {
    ok: { bg: "#F0FDF4", bd: T.success500, label: "OK", lblBg: T.success100, lblFg: T.success500 },
    warning: { bg: "#FFFBEB", bd: T.warning500, label: "UYARI", lblBg: T.warning100, lblFg: T.warning500 },
    danger: { bg: "#FEF2F2", bd: T.danger500, label: "HATA", lblBg: T.danger100, lblFg: T.danger500 },
    purple: { bg: "#FAF5FF", bd: T.purple500, label: "KONTROL", lblBg: T.purple100, lblFg: T.purple500 },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="import" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.bg, minWidth: 0 }}>
          {/* HEADER ÖZET */}
          <div style={{ padding: "16px 24px", background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Import / Önizleme</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.brand900, marginTop: 2 }}>EV ABONELİKLERİ ALBARAKA OTOMATİK ÖDEMELER.xlsx</div>
              <div style={{ fontSize: 11, color: T.ink2 }}>Hedef: Fatura + Ödeme · Mapping: ev_abonelikleri_kisi_sheet_v1</div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 16 }}>
              {[
                ["Toplam", 42, T.ink],
                ["Yeşil", 34, T.success500],
                ["Sarı", 3, T.warning500],
                ["Kırmızı", 3, T.danger500],
                ["Mor", 2, T.purple500],
              ].map(([l, n, c]) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{n}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 3 PANEL */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr 360px", minHeight: 0 }}>
            {/* SOL: Belge önizleme */}
            <div style={{ background: T.card, borderRight: `1px solid ${T.border}`, padding: 16, overflowY: "auto" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Belge Önizleme</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {["ABONELİKLER", "MEHMET RAHİM", "MEHMET ALİ", "ALİ ACME", "SELÇUK", "KAAN", "RENK APT"].map((s, i) => (
                  <div key={s} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: i === 1 ? T.brand700 : T.brand100, color: i === 1 ? "#fff" : T.brand700, cursor: "pointer" }}>{s}</div>
                ))}
              </div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", fontSize: 10, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
                <div style={{ background: T.brand100, padding: "6px 8px", color: T.brand700, fontWeight: 700 }}>2026 YILI MEHMET RAHİM ACME OTOMATİK</div>
                {[
                  ["FİRMA", "HESAP NO", "OCAK"],
                  ["TÜRK TELEKOM", "0212 573 13 40", "16.01.2026"],
                  ["", "", "187,00"],
                  ["İNTERNET", "1899409819", "16.01.2026"],
                  ["", "", "683,60"],
                  ["TURKCELL", "0535 671 36 50", "—"],
                ].map((r, i) => (
                  <div key={i} style={{ padding: "5px 8px", display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr", gap: 6, borderTop: i > 0 ? `1px solid ${T.border}` : "none", background: i === 0 ? "#fff" : i % 2 === 0 ? "#fff" : "#FAFBFC", color: T.ink2 }}>
                    {r.map((c, j) => <div key={j} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</div>)}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: 10, background: T.brand100, borderRadius: 6, fontSize: 11, color: T.brand700 }}>
                💡 "X" hücreler iptal varsayılır. Tutar boş satırlarda kontrol gerekir.
              </div>
            </div>

            {/* ORTA: Renk kodlu satır tablosu */}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ padding: "10px 16px", background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                {[["Tümü", true], ["Hatalı", false], ["Uyarı", false], ["Kontrol", false]].map(([l, a]) => (
                  <div key={l} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: a ? T.brand700 : T.brand100, color: a ? "#fff" : T.brand700, cursor: "pointer" }}>{l}</div>
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 11, color: T.ink2 }}>Çift tıkla = inline edit</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "32px 32px 1.4fr 1.6fr 90px 110px 100px", gap: 8, padding: "10px 16px", background: T.brand100, fontSize: 10, fontWeight: 700, color: T.brand700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <div>☐</div><div>#</div><div>Sahip / Sheet</div><div>Abonelik / Açıklama</div><div>Dönem</div><div style={{ textAlign: "right" }}>Tutar</div><div>Durum</div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
                {rows.map((r, i) => {
                  const c = colorMap[r.status];
                  const sel = i === 4;
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 32px 1.4fr 1.6fr 90px 110px 100px", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 12, background: sel ? T.brand100 : c.bg, borderLeft: `4px solid ${c.bd}`, cursor: "pointer", outline: sel ? `1.5px solid ${T.brand500}` : "none" }}>
                      <div style={{ color: T.ink2 }}>☐</div>
                      <div style={{ color: T.ink2, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{i + 1}</div>
                      <div style={{ fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sheet}</div>
                      <div style={{ color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.abon}</div>
                      <div style={{ color: T.ink2, fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11 }}>{r.per}</div>
                      <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 600, color: r.t === null || r.t === 0 ? T.muted : T.brand900 }}>
                        {r.t === null ? "—" : r.t === 0 ? "0,00" : MoneyTR(r.t)}
                      </div>
                      <div><StatusTag label={c.label} bg={c.lblBg} fg={c.lblFg} /></div>
                    </div>
                  );
                })}
              </div>
              {/* ALT STICKY AKSİYON BAR */}
              <div style={{ padding: "12px 16px", background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Btn variant="success" size="md">✓ Tümünü Onayla</Btn>
                <Btn variant="primary" size="md">Sadece Yeşilleri (34)</Btn>
                <Btn variant="secondary" size="md">Mapping'e Dön</Btn>
                <Btn variant="ghost" size="md">Taslakta Bırak</Btn>
                <div style={{ flex: 1 }} />
                <Btn variant="ghost" size="md" style={{ color: T.ink2 }}>Importu İptal</Btn>
                <Btn variant="danger" size="md">✕ Reddet</Btn>
              </div>
            </div>

            {/* SAĞ: Doğrulama / düzeltme paneli */}
            <div style={{ background: T.card, borderLeft: `1px solid ${T.border}`, padding: 16, overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Satır Düzeltme · #5</div>
                <StatusTag label="HATA" bg={T.danger100} fg={T.danger500} />
              </div>
              <div style={{ padding: 10, background: T.danger100, borderRadius: 8, fontSize: 12, color: T.danger500, marginBottom: 14, lineHeight: 1.5 }}>
                <b>⚠ Tutar boş.</b> Excel hücresi "X" işaretli. Bu satır iptal mı, manuel tutar mı girmek istiyorsunuz?
              </div>
              <div style={{ marginBottom: 12 }}>
                <FieldLabel>Sahip</FieldLabel>
                <Input value="Test Kullanıcı" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <FieldLabel>Abonelik / Mülk</FieldLabel>
                <Input value="SiteX B3.31 · Aidat" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <FieldLabel>Dönem (yyyymm)</FieldLabel>
                <Input value="202601" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <FieldLabel>Tutar (TRY) *</FieldLabel>
                <div style={{ height: 40, border: `1.5px solid ${T.danger500}`, borderRadius: 8, padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", fontSize: 14, color: T.danger500 }}>
                  Zorunlu — manuel girin
                </div>
                <div style={{ fontSize: 11, color: T.danger500, marginTop: 4, fontWeight: 600 }}>Tutar 0'dan büyük olmalıdır.</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>İşaret</FieldLabel>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn variant="secondary" size="sm">İptal et</Btn>
                  <Btn variant="primary" size="sm">Tutar Gir</Btn>
                  <Btn variant="ghost" size="sm">Atla</Btn>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <Btn variant="success" size="md" style={{ justifyContent: "center" }}>✓ Bu Satırı Onayla</Btn>
                <Btn variant="accent" size="md" style={{ justifyContent: "center" }}>🛡 Kontrol Gerekli İşaretle</Btn>
                <Btn variant="ghost" size="md" style={{ justifyContent: "center", color: T.danger500 }}>Bu Satırı Reddet</Btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SPRINT 1B — Yardımcılar
   ============================================================ */
function PayMethodTag({ method }) {
  const map = {
    OTOMATIK: { bg: T.info100, fg: T.info500 },
    EFT: { bg: T.success100, fg: T.success500 },
    HAVALE: { bg: "#E0F2FE", fg: "#0369A1" },
    "KREDİ KARTI": { bg: T.purple100, fg: T.purple500 },
    ELDEN: { bg: T.warning100, fg: T.warning500 },
    NAKIT: { bg: "#F1F3F5", fg: T.ink2 },
  };
  const c = map[method] || map.NAKIT;
  return <StatusTag label={method} bg={c.bg} fg={c.fg} />;
}

/* ============================================================
   FRAME 5 — 05 Fatura / Ödeme Listesi
   ============================================================ */
function InvoiceListFrame() {
  const kpis = [
    { l: "Bugün Ödenecek", v: MoneyTR(48750.25), d: "12 kalem", c: T.brand900 },
    { l: "7 Gün İçinde", v: MoneyTR(186420.0), d: "23 kalem", c: T.orange500 },
    { l: "Geciken", v: MoneyTR(112430.0), d: "7 kalem", c: T.danger500 },
    { l: "Eksik Dekont", v: "9", d: "5.000 TL üzeri", c: T.orange500 },
    { l: "Bu Ay Toplam", v: MoneyTR(1248755.4), d: "186 kalem", c: T.brand700 },
    { l: "Ödenen", v: MoneyTR(862330.15), d: "%69 tahsil", c: T.success500 },
  ];

  const rows = [
    { sahip: "Acme Enerji", st: "Şirket", kurum: "Türk Telekom", kat: "İnternet", per: "2026-05", son: "20.05.2026", tutar: 12430.5, met: "OTOMATIK", st2: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, dek: "OK", gor: "1" },
    { sahip: "Test Kullanıcı", st: "Şahıs", kurum: "SiteX B3.31", kat: "Aidat", per: "2026-05", son: "20.05.2026", tutar: 18750, met: "EFT", st2: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, dek: "—", gor: "—" },
    { sahip: "Acme Tekstil", st: "Şirket", kurum: "CK Boğaziçi", kat: "Elektrik", per: "2026-05", son: "15.05.2026", tutar: 86220.4, met: "OTOMATIK", st2: "ÖDENDİ", stBg: T.success100, stFg: T.success500, dek: "OK", gor: "—" },
    { sahip: "Beta Tekstil", st: "Şirket", kurum: "SMMM Hizmet", kat: "Müşavirlik", per: "2026-05", son: "10.05.2026", tutar: 25000, met: "EFT", st2: "GECİKTİ", stBg: T.danger100, stFg: T.danger500, dek: "—", gor: "1" },
    { sahip: "Ali Acme", st: "Şahıs", kurum: "İGDAŞ", kat: "Doğalgaz", per: "2026-05", son: "17.05.2026", tutar: 3450.75, met: "OTOMATIK", st2: "DEKONT EKSİK", stBg: T.orange100, stFg: T.orange500, dek: "EKSİK", gor: "1" },
    { sahip: "Acme Enerji", st: "Şirket", kurum: "Albaraka", kat: "Teminat Komisyon", per: "2026-05", son: "08.05.2026", tutar: 45200, met: "HAVALE", st2: "ÖDENDİ", stBg: T.success100, stFg: T.success500, dek: "OK", gor: "—" },
    { sahip: "Mehmet Rahim Acme", st: "Şahıs", kurum: "TTNet", kat: "İnternet", per: "2026-05", son: "16.05.2026", tutar: 683.6, met: "OTOMATIK", st2: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, dek: "—", gor: "—" },
    { sahip: "KC İplik", st: "Şirket", kurum: "Çardak Aidat", kat: "Aidat", per: "2026-05", son: "25.05.2026", tutar: 8500, met: "ELDEN", st2: "TASLAK", stBg: T.info100, stFg: T.info500, dek: "—", gor: "—" },
    { sahip: "Kaan Acme", st: "Şahıs", kurum: "SiteX B2.28", kat: "Aidat", per: "2026-05", son: "22.05.2026", tutar: 28344, met: "EFT", st2: "KONTROL GEREKLİ", stBg: T.purple100, stFg: T.purple500, dek: "—", gor: "1" },
    { sahip: "MakYapı", st: "Şirket", kurum: "Beyoğlu Bld.", kat: "Emlak Vergisi", per: "2026-D1", son: "31.05.2026", tutar: 97191.6, met: "HAVALE", st2: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, dek: "—", gor: "1" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="fatura" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          {/* PAGE HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Operasyon / Fatura & Ödeme</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Fatura & Ödeme Takibi</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Şirket ve şahıs faturaları, ödeme durumları, dekont ve görev takibi.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">⬆ Excel/PDF Import</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Fatura</Btn>
            </div>
          </div>

          {/* KPI BANDI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.c, marginTop: 6, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{k.v}</div>
                <div style={{ fontSize: 11, color: T.ink2, marginTop: 4 }}>{k.d}</div>
              </Card>
            ))}
          </div>

          {/* FILTER BAR */}
          <Card pad={14} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", flex: "1 1 240px", minWidth: 220, color: T.muted, fontSize: 13 }}>
                {Ico.search}<span>Sahip, kurum, fatura no...</span>
              </div>
              {[
                "📅 01.05 → 31.05.2026",
                "Tip: Tümü ▾",
                "Sahip: Tümü ▾",
                "Kategori: Tümü ▾",
                "Kurum: Tümü ▾",
                "Durum: Tümü ▾",
                "Yöntem: Tümü ▾",
                "Dekont: Tümü ▾",
                "Kaynak: Tümü ▾",
              ].map((c) => (
                <div key={c} style={{ height: 32, padding: "0 10px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 12, color: T.ink2 }}>{c}</div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 8, background: T.danger100, color: T.danger500, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 28, height: 16, background: T.danger500, borderRadius: 9999, position: "relative" }}>
                  <span style={{ position: "absolute", right: 2, top: 2, width: 12, height: 12, background: "#fff", borderRadius: 9999 }} />
                </span>
                Sadece Geciken
              </div>
              <Btn variant="ghost" size="sm">Temizle</Btn>
            </div>
          </Card>

          {/* GÖRÜNÜM TOGGLE + TABLO */}
          <Card pad={0}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              {[["📋 Liste", true], ["📊 Ay Matrisi", false], ["🗂 Kart", false]].map(([l, a]) => (
                <div key={l} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: a ? T.brand700 : "transparent", color: a ? "#fff" : T.ink2, cursor: "pointer", border: a ? "none" : `1px solid ${T.border}` }}>{l}</div>
              ))}
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 12, color: T.ink2 }}>186 kayıt · sayfa 1 / 8</div>
            </div>

            {/* TOPLU AKSİYON BAR */}
            <div style={{ padding: "10px 16px", background: T.brand100, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.brand700 }}>
              <span style={{ fontWeight: 700 }}>3 satır seçildi</span>
              <div style={{ width: 1, height: 16, background: T.brand300 }} />
              <Btn variant="success" size="sm">✓ Ödendi İşaretle</Btn>
              <Btn variant="secondary" size="sm">+ Görev Oluştur</Btn>
              <Btn variant="secondary" size="sm">📎 Dekont İste</Btn>
              <Btn variant="ghost" size="sm">Export</Btn>
              <Btn variant="ghost" size="sm">Arşivle</Btn>
              <div style={{ flex: 1 }} />
              <Btn variant="ghost" size="sm">Seçimi temizle</Btn>
            </div>

            {/* TABLO HEADER */}
            <div style={{ display: "grid", gridTemplateColumns: "32px 1.3fr 1.3fr 1fr 90px 110px 130px 110px 130px 90px 70px 90px", gap: 8, padding: "10px 16px", background: "#FAFBFC", fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
              <div>☐</div><div>Sahip</div><div>Kurum / Açıklama</div><div>Kategori</div><div>Dönem</div><div>Son Ödeme</div><div style={{ textAlign: "right" }}>Tutar</div><div>Yöntem</div><div>Durum</div><div>Dekont</div><div>Görev</div><div>Aksiyon</div>
            </div>

            {/* TABLO ROWS */}
            {rows.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 1.3fr 1.3fr 1fr 90px 110px 130px 110px 130px 90px 70px 90px", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 12, background: i < 3 ? T.brand100 : "#fff" }}>
                <div style={{ color: T.ink2 }}>{i < 3 ? "☑" : "☐"}</div>
                <div>
                  <div style={{ fontWeight: 600, color: T.ink, fontSize: 13 }}>{r.sahip}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{r.st}</div>
                </div>
                <div style={{ color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.kurum}</div>
                <div style={{ color: T.ink2 }}>{r.kat}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11, color: T.ink2 }}>{r.per}</div>
                <div style={{ color: T.ink2 }}>{r.son}</div>
                <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: T.brand900 }}>{MoneyTR(r.tutar)}</div>
                <div><PayMethodTag method={r.met} /></div>
                <div><StatusTag label={r.st2} bg={r.stBg} fg={r.stFg} pulse={r.st2 === "GECİKTİ"} /></div>
                <div>{r.dek === "OK" ? <span style={{ color: T.success500, fontWeight: 700 }}>✓</span> : r.dek === "EKSİK" ? <StatusTag label="EKSİK" bg={T.orange100} fg={T.orange500} /> : <span style={{ color: T.muted }}>—</span>}</div>
                <div>{r.gor !== "—" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", background: T.info100, color: T.info500, borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>📋 {r.gor}</span> : <span style={{ color: T.muted }}>—</span>}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 12 }}>✓</button>
                  <button style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 12 }}>⋯</button>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* SAĞ MİNİ DRAWER */}
        <div style={{ width: 320, background: T.card, borderLeft: `1px solid ${T.border}`, padding: 16, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Hızlı Önizleme</div>
            <span style={{ fontSize: 11, color: T.muted, cursor: "pointer" }}>✕</span>
          </div>
          <div style={{ padding: 12, background: T.brand100, borderRadius: 10, marginBottom: 12 }}>
            <StatusTag label="YAKLAŞIYOR" bg={T.orange100} fg={T.orange500} />
            <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginTop: 8 }}>Türk Telekom — Mayıs İnternet</div>
            <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>Acme Enerji · Şirket</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Tutar</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.brand900, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{MoneyTR(12430.5)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Son Ödeme</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.danger500 }}>20.05.2026</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            <Btn variant="primary" size="sm" style={{ justifyContent: "center" }}>✓ Ödendi İşaretle</Btn>
            <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>📎 Dekont Yükle</Btn>
            <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>+ Görev Oluştur</Btn>
            <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>Detay sayfası →</Btn>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Son İşlemler</div>
          {[
            ["Ayşe", "Fatura import etti", "12 dk"],
            ["Sistem", "Görev oluşturuldu", "1 sa"],
            ["Müdür", "Hatırlatma ayarlandı", "3 sa"],
          ].map(([u, e, t], i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: i < 2 ? `1px solid ${T.border}` : "none", fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: T.brand700 }}>{u}</span>
              <span style={{ color: T.ink2 }}> {e} </span>
              <span style={{ color: T.muted }}>· {t}</span>
            </div>
          ))}

          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 16, marginBottom: 8 }}>Bağlı Görevler (1)</div>
          <div style={{ padding: 10, border: `1px solid ${T.border}`, borderRadius: 8, borderLeft: `3px solid ${T.warning500}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>TT internet ödemesini yap</div>
            <div style={{ fontSize: 11, color: T.ink2, marginTop: 4 }}>Atanan: Ayşe · Son: 20.05.2026</div>
          </div>

          <div style={{ marginTop: 16, padding: 10, background: T.brand100, borderRadius: 8, fontSize: 11, color: T.brand700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            💬 Bu kayıtla ilgili sohbet aç →
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 6 — 06 Fatura / Ödeme Detay
   ============================================================ */
function InvoiceDetailFrame() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="fatura" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          {/* BREADCRUMB */}
          <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Operasyon / Fatura & Ödeme / <span style={{ color: T.brand900 }}>TT-2026-0419</span>
          </div>

          {/* PAGE HEADER CARD */}
          <Card pad={20} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <StatusTag label="YAKLAŞIYOR" bg={T.orange100} fg={T.orange500} />
                  <PayMethodTag method="OTOMATIK" />
                  <span style={{ fontSize: 11, color: T.muted, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>TT-2026-0419</span>
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: T.brand900, margin: 0 }}>Türk Telekom — Mayıs 2026 İnternet Faturası</h1>
                <div style={{ fontSize: 13, color: T.ink2, marginTop: 6 }}>
                  <b style={{ color: T.ink }}>Sahip:</b> Acme Enerji (Yeniçe HES) ·
                  <b style={{ color: T.ink }}> Hesap:</b> 7024574723 ·
                  <b style={{ color: T.ink }}> Adres:</b> Yeniçe Mah. Yeniçe Sk. No:1
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Btn variant="ghost" size="sm">Düzenle</Btn>
                <Btn variant="secondary" size="sm">📎 Dekont Yükle</Btn>
                <Btn variant="secondary" size="sm">+ Görev</Btn>
                <Btn variant="secondary" size="sm">💬 Chat</Btn>
                <Btn variant="primary" size="sm">✓ Ödeme Bağla</Btn>
              </div>
            </div>
          </Card>

          {/* ÜST ÖZET KARTLARI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { l: "Fatura Tutarı", v: MoneyTR(12430.5), c: T.brand900, mono: true },
              { l: "Son Ödeme", v: "20.05.2026", c: T.danger500 },
              { l: "Ödenen", v: MoneyTR(0), c: T.muted, mono: true },
              { l: "Kalan", v: MoneyTR(12430.5), c: T.danger500, mono: true },
              { l: "Yöntem", v: "Otomatik", c: T.info500 },
              { l: "Dekont", v: "Bekleniyor", c: T.warning500 },
            ].map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: k.c, marginTop: 6, fontFamily: k.mono ? "'IBM Plex Mono', ui-monospace, monospace" : "inherit" }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* TABS */}
          <Card pad={0}>
            <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 16px", display: "flex", gap: 4 }}>
              {[
                ["Genel", true, null],
                ["Ödemeler", false, "0"],
                ["Belgeler", false, "1"],
                ["Görevler", false, "1"],
                ["Chat", false, "3"],
                ["Audit", false, "12"],
                ["İlişkili", false, "4"],
              ].map(([l, a, c]) => (
                <div key={l} style={{ padding: "14px 16px", fontSize: 13, fontWeight: a ? 700 : 500, color: a ? T.brand900 : T.ink2, borderBottom: a ? `2px solid ${T.brand700}` : "2px solid transparent", marginBottom: -1, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {l}
                  {c && <span style={{ padding: "1px 6px", background: a ? T.brand700 : T.border, color: a ? "#fff" : T.ink2, borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>{c}</span>}
                </div>
              ))}
            </div>

            {/* GENEL TAB CONTENT */}
            <div style={{ padding: 24, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
              {/* SOL */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.brand900, margin: "0 0 12px" }}>Kayıt Bilgileri</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[
                    ["Sahip", "Acme Enerji Üretim A.Ş."],
                    ["Sahip Tipi", "Şirket"],
                    ["Kurum", "Türk Telekom (TTNet)"],
                    ["Hesap No", "7024574723"],
                    ["Hizmet No", "8817493397"],
                    ["Kategori", "İnternet"],
                    ["Dönem", "2026-05 (Mayıs)"],
                    ["Fatura Tarihi", "01.05.2026"],
                    ["Son Ödeme Tarihi", "20.05.2026"],
                    ["Otomatik Ödeme", "Albaraka Talimat"],
                    ["Paket", "İŞTE GÜÇLENDİREN KAMPANYA_5"],
                    ["Taahhüt Bitiş", "14.02.2027"],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                      <div style={{ fontSize: 13, color: T.ink, marginTop: 4 }}>{v}</div>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.brand900, margin: "20px 0 10px" }}>Notlar</h3>
                <div style={{ padding: 12, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.ink, background: "#fff", lineHeight: 1.55 }}>
                  Bu fatura Yeniçe HES internet hattıdır. Albaraka talimatı aktiftir; otomatik tahsilat son ödeme günü gerçekleşir. Geçmiş 6 ayda gecikme yok.
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.brand900, margin: "20px 0 10px" }}>Ödeme Geçmişi (Timeline preview)</h3>
                <div style={{ position: "relative", paddingLeft: 20 }}>
                  <div style={{ position: "absolute", left: 7, top: 4, bottom: 4, width: 2, background: T.border }} />
                  {[
                    ["Mayıs 2026", "Bekliyor — son ödeme 20.05.2026", T.warning500, MoneyTR(12430.5)],
                    ["Nisan 2026", "Otomatik tahsil edildi · Albaraka", T.success500, MoneyTR(11890.25)],
                    ["Mart 2026", "Otomatik tahsil edildi · Albaraka", T.success500, MoneyTR(12100.0)],
                    ["Şubat 2026", "Otomatik tahsil edildi · Albaraka", T.success500, MoneyTR(11750.5)],
                  ].map(([m, d, c, t], i) => (
                    <div key={i} style={{ position: "relative", paddingBottom: 14 }}>
                      <div style={{ position: "absolute", left: -19, top: 4, width: 12, height: 12, borderRadius: 9999, background: c, border: "2px solid #fff", boxShadow: `0 0 0 2px ${c}` }} />
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{m}</div>
                          <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>{d}</div>
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: T.brand900, fontSize: 13 }}>{t}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SAĞ */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.brand900, margin: "0 0 12px" }}>Belgeler (Önizleme)</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    ["Mayıs Faturası", "fatura_2026-05.pdf", "245 KB", T.danger500, "PDF"],
                    ["Import Kaynağı", "EV_ABONELIKLERI.xlsx", "36 KB", T.success500, "XLSX"],
                  ].map(([t, f, s, c, ext], i) => (
                    <div key={i} style={{ padding: 10, border: `1px solid ${T.border}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10, background: "#fff" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800 }}>{ext}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</div>
                        <div style={{ fontSize: 11, color: T.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f} · {s}</div>
                      </div>
                      <button style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12 }}>👁</button>
                    </div>
                  ))}
                  <div style={{ padding: "10px 12px", border: `1px dashed ${T.border}`, borderRadius: 8, textAlign: "center", fontSize: 12, color: T.ink2, cursor: "pointer" }}>
                    + Dekont yükle (zorunlu — 5.000 TL üzeri)
                  </div>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.brand900, margin: "20px 0 10px" }}>Bağlı Görevler (1)</h3>
                <div style={{ padding: 12, border: `1px solid ${T.border}`, borderRadius: 8, borderLeft: `3px solid ${T.warning500}`, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>TT internet ödemesini yap</div>
                    <StatusTag label="GÖREV AÇIK" bg={T.info100} fg={T.info500} />
                  </div>
                  <div style={{ fontSize: 11, color: T.ink2, marginTop: 6 }}>Atanan: Ayşe · Atayan: Müdür · Son: 20.05.2026</div>
                  <div style={{ fontSize: 11, color: T.ink2, marginTop: 2, display: "flex", gap: 10 }}>💬 2 yorum · 📎 0 ek</div>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.brand900, margin: "20px 0 10px" }}>Chat Önizleme</h3>
                <div style={{ padding: 10, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.brand700, marginBottom: 8 }}>📎 Bu kayıt thread'i · 3 mesaj</div>
                  <div style={{ fontSize: 12, color: T.ink2 }}><b>Ayşe:</b> Albaraka talimatı aktif, sorun yok ✓</div>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.brand900, margin: "20px 0 10px" }}>Audit (Son 3)</h3>
                <div style={{ fontSize: 11, color: T.ink2, lineHeight: 1.7 }}>
                  <div><b style={{ color: T.brand700 }}>Sistem</b> · görev oluşturdu · 12.05 09:00</div>
                  <div><b style={{ color: T.brand700 }}>Ayşe</b> · import onayladı · 05.05 14:32</div>
                  <div><b style={{ color: T.brand700 }}>Sistem</b> · kayıt oluşturuldu · 05.05 14:30</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 7 — 07 Ödeme İşaretleme Modal
   ============================================================ */
function PaymentMarkModalFrame() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="fatura" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, position: "relative" }}>
          {/* Arka plan: dim'lenmiş liste */}
          <div style={{ opacity: 0.35, pointerEvents: "none" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: 0 }}>Fatura & Ödeme Takibi</h1>
            <div style={{ marginTop: 16, padding: 16, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 12 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ height: 44, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 16, height: 16, background: T.border, borderRadius: 4 }} />
                  <div style={{ width: 160, height: 12, background: T.border, borderRadius: 4 }} />
                  <div style={{ width: 200, height: 12, background: T.border, borderRadius: 4 }} />
                  <div style={{ flex: 1 }} />
                  <div style={{ width: 100, height: 12, background: T.border, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Modal Overlay */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,37,64,0.45)", backdropFilter: "blur(2px)" }} />

          {/* MODAL */}
          <div style={{ position: "absolute", left: "50%", top: 24, transform: "translateX(-50%)", width: 720, background: T.card, borderRadius: 16, boxShadow: "0 24px 56px rgba(15,37,64,0.20)", border: `1px solid ${T.border}`, overflow: "hidden", maxHeight: "calc(100% - 48px)", display: "flex", flexDirection: "column" }}>
            {/* HEADER */}
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: T.brand900 }}>Ödeme Bilgisi Ekle</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 4 }}>Türk Telekom — Mayıs 2026 İnternet Faturası</div>
              </div>
              <button style={{ width: 32, height: 32, border: "none", background: "transparent", color: T.ink2, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* BODY */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {/* KAYIT ÖZETİ KART */}
              <div style={{ padding: 14, background: T.brand100, borderRadius: 10, marginBottom: 18, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                {[
                  ["Tutar", MoneyTR(12430.5), T.brand900, true],
                  ["Son Ödeme", "20.05.2026", T.danger500, false],
                  ["Mevcut Durum", "YAKLAŞIYOR", T.orange500, false],
                  ["Sahip / Kurum", "Acme Enerji · TT", T.ink, false],
                ].map(([l, v, c, m]) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.brand500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c, marginTop: 4, fontFamily: m ? "'IBM Plex Mono', ui-monospace, monospace" : "inherit" }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* ÖDEME DURUMU */}
              <FieldLabel>Ödeme Durumu *</FieldLabel>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[
                  ["✓ Ödendi", true, T.success500],
                  ["◐ Kısmi Ödendi", false, T.warning500],
                  ["⚠ Kontrol Gerekli", false, T.purple500],
                ].map(([l, sel, c]) => (
                  <div key={l} style={{ flex: 1, padding: "12px 14px", border: `1.5px solid ${sel ? c : T.border}`, borderRadius: 8, background: sel ? `${c}15` : "#fff", color: sel ? c : T.ink2, fontWeight: 600, fontSize: 13, textAlign: "center", cursor: "pointer" }}>
                    {l}
                  </div>
                ))}
              </div>

              {/* TARİH + TUTAR */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <FieldLabel>Ödeme Tarihi *</FieldLabel>
                  <Input value="14.05.2026" />
                </div>
                <div>
                  <FieldLabel>Ödenen Tutar (TRY) *</FieldLabel>
                  <Input value="12.430,50" />
                </div>
              </div>

              {/* GEÇ ÖDEME UYARISI (örnek görünüm) */}
              <div style={{ padding: 10, background: T.warning100, border: `1px solid ${T.warning500}40`, borderRadius: 8, marginBottom: 14, fontSize: 12, color: T.warning500, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                ⚠ Ödeme tarihi son ödeme tarihinden önceki bir tarih. (Örnek) Geç ödeme durumunda burada uyarı görünür.
              </div>

              {/* YÖNTEM */}
              <FieldLabel>Ödeme Yöntemi *</FieldLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {[
                  ["OTOMATIK", true],
                  ["EFT", false],
                  ["HAVALE", false],
                  ["KREDİ KARTI", false],
                  ["ELDEN", false],
                  ["NAKIT", false],
                ].map(([m, sel]) => (
                  <div key={m} style={{ padding: "8px 14px", border: `1.5px solid ${sel ? T.brand700 : T.border}`, borderRadius: 8, background: sel ? T.brand100 : "#fff", color: sel ? T.brand700 : T.ink2, fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m}</div>
                ))}
              </div>

              {/* BANKA + DEKONT */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <FieldLabel>Banka</FieldLabel>
                  <Input value="Albaraka Türk" />
                </div>
                <div>
                  <FieldLabel>Dekont</FieldLabel>
                  <div style={{ height: 40, border: `1px dashed ${T.brand500}`, borderRadius: 8, padding: "0 12px", display: "flex", alignItems: "center", gap: 8, background: T.brand100, color: T.brand700, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    📎 Dekont Yükle
                    <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>PDF, JPG, PNG · Maks 10 MB</span>
                  </div>
                </div>
              </div>

              {/* NOT */}
              <FieldLabel>Not</FieldLabel>
              <div style={{ height: 70, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, fontSize: 13, color: T.muted, background: "#fff", marginBottom: 14 }}>
                Açıklama veya not ekleyin (opsiyonel)...
              </div>

              {/* CHECKBOX'LAR */}
              <div style={{ padding: 12, background: T.bg, borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.ink, cursor: "pointer" }}>
                  <span style={{ width: 18, height: 18, background: T.brand700, color: "#fff", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>✓</span>
                  <span><b>Bağlı görevi tamamla</b> — "TT internet ödemesini yap" görevi de tamamlanmış olacak.</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.ink2, cursor: "pointer" }}>
                  <span style={{ width: 18, height: 18, border: `1.5px solid ${T.border}`, borderRadius: 4, background: "#fff" }} />
                  <span>
                    <b>Telegram bildirimi oluştur</b>
                    <span style={{ marginLeft: 8, padding: "2px 6px", background: T.warning100, color: T.warning500, borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>DRY-RUN</span>
                    <span style={{ color: T.muted }}> — Gerçek gönderim Faz 12'de açılır.</span>
                  </span>
                </label>
              </div>
            </div>

            {/* FOOTER */}
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
              <div style={{ fontSize: 11, color: T.ink2, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                🛡 Bu işlem AuditLog'a kaydedilecektir.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn variant="ghost" size="md">İptal</Btn>
                <Btn variant="secondary" size="md">Taslakta Bırak</Btn>
                <Btn variant="primary" size="md">Kaydet</Btn>
                <Btn variant="success" size="md">✓ Kaydet ve Görevi Tamamla</Btn>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 8 — 08 Abonelik & Taahhüt Listesi
   ============================================================ */
function SubscriptionListFrame() {
  const kpis = [
    { l: "Aktif Abonelik", v: "48", c: T.brand900 },
    { l: "30 Gün İçinde Bitecek", v: "4", c: T.orange500 },
    { l: "Otomatik Ödemede", v: "39", c: T.success500 },
    { l: "Kontrol Gerekli", v: "3", c: T.purple500 },
    { l: "Bu Ay Beklenen", v: MoneyTR(184250.0), c: T.brand700, mono: true },
    { l: "Paket Tutarı Eksik", v: "7", c: T.warning500 },
  ];
  const rows = [
    { sahip: "Acme Enerji", st: "Şirket", kurum: "Türk Telekom", hiz: "İnternet", no: "1899409819", paket: "Kurumsal Fiber", tutar: 12430.5, oto: "Albaraka", taah: "20.08.2026", days: 95, st2: "AKTİF", stBg: T.success100, stFg: T.success500, gor: "—" },
    { sahip: "Acme Tekstil", st: "Şirket", kurum: "CK Boğaziçi", hiz: "Elektrik", no: "TES-4338211", paket: "Sanayi T1", tutar: 86220.4, oto: "Garanti", taah: "Taahhüt Yok", days: null, st2: "AKTİF", stBg: T.success100, stFg: T.success500, gor: "—" },
    { sahip: "Test Kullanıcı", st: "Şahıs", kurum: "Turkcell", hiz: "GSM", no: "0532 318 16 68", paket: "Süper Plus", tutar: 1250.0, oto: "Albaraka", taah: "15.06.2026", days: 31, st2: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, gor: "1" },
    { sahip: "Beta Tekstil", st: "Şirket", kurum: "TTNet", hiz: "İnternet", no: "8817493397", paket: "İşte Güçlendiren", tutar: 4850.0, oto: "Elden", taah: "01.07.2026", days: 47, st2: "KONTROL GEREKLİ", stBg: T.purple100, stFg: T.purple500, gor: "1" },
    { sahip: "Ali Acme", st: "Şahıs", kurum: "İGDAŞ", hiz: "Doğalgaz", no: "500200857270", paket: "Konut", tutar: 3450.75, oto: "Albaraka", taah: "Taahhüt Yok", days: null, st2: "AKTİF", stBg: T.success100, stFg: T.success500, gor: "—" },
    { sahip: "Mehmet Rahim Acme", st: "Şahıs", kurum: "Türk Telekom", hiz: "Ev Telefon", no: "0212 573 13 40", paket: "Ev Avantaj 100", tutar: 187.0, oto: "Albaraka", taah: "Taahhüt Yok", days: null, st2: "AKTİF", stBg: T.success100, stFg: T.success500, gor: "—" },
    { sahip: "KC İplik", st: "Şirket", kurum: "TTNet", hiz: "İnternet", no: "7025623126", paket: "100 Mbps", tutar: 570.0, oto: "Albaraka", taah: "14.02.2027", days: 285, st2: "AKTİF", stBg: T.success100, stFg: T.success500, gor: "—" },
    { sahip: "Mehmet Ali Acme", st: "Şahıs", kurum: "CK Boğaziçi", hiz: "Elektrik", no: "6528159400", paket: "Konut", tutar: 1340.0, oto: "Albaraka", taah: "Taahhüt Yok", days: null, st2: "İPTAL DİLEKÇESİ", stBg: T.warning100, stFg: T.warning500, gor: "1" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="abonelik" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Operasyon / Abonelik & Taahhüt</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Abonelik & Taahhüt Takibi</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Şirket ve şahıs abonelikleri, otomatik ödeme, paket ve taahhüt bitiş takibi.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">📅 Taahhüt Takvimi</Btn>
              <Btn variant="secondary" size="md">⬆ Excel Import</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Abonelik</Btn>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.c, marginTop: 6, fontFamily: k.mono ? "'IBM Plex Mono', ui-monospace, monospace" : "inherit" }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* FILTER BAR */}
          <Card pad={14} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", flex: "1 1 240px", minWidth: 220, color: T.muted, fontSize: 13 }}>
                {Ico.search}<span>Sahip, hesap no, kurum...</span>
              </div>
              {["Tip: Tümü ▾", "Sahip: Tümü ▾", "Kurum: Tümü ▾", "Hizmet: Tümü ▾", "Banka: Tümü ▾", "Taahhüt: Tümü ▾", "Durum: Tümü ▾"].map((c) => (
                <div key={c} style={{ height: 32, padding: "0 10px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 12, color: T.ink2 }}>{c}</div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 8, background: T.orange100, color: T.orange500, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 28, height: 16, background: T.orange500, borderRadius: 9999, position: "relative" }}>
                  <span style={{ position: "absolute", right: 2, top: 2, width: 12, height: 12, background: "#fff", borderRadius: 9999 }} />
                </span>
                Bitişi yaklaşan
              </div>
              <Btn variant="ghost" size="sm">Temizle</Btn>
            </div>
          </Card>

          {/* TOGGLE + TABLO */}
          <Card pad={0}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              {[["📋 Liste", true], ["📅 Taahhüt Takvimi", false], ["🗂 Kart", false]].map(([l, a]) => (
                <div key={l} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: a ? T.brand700 : "transparent", color: a ? "#fff" : T.ink2, cursor: "pointer", border: a ? "none" : `1px solid ${T.border}` }}>{l}</div>
              ))}
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 12, color: T.ink2 }}>48 abonelik</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 90px 130px 1fr 110px 100px 130px 130px 60px 80px", gap: 8, padding: "10px 16px", background: "#FAFBFC", fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
              <div>Sahip</div><div>Kurum</div><div>Hizmet</div><div>Hesap/Hizmet No</div><div>Paket</div><div style={{ textAlign: "right" }}>Tutar</div><div>Otomatik</div><div>Taahhüt Bitişi</div><div>Durum</div><div>Görev</div><div>Aksiyon</div>
            </div>

            {rows.map((r, i) => {
              const isSelected = i === 2;
              const dangerTaah = r.days !== null && r.days < 60;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 90px 130px 1fr 110px 100px 130px 130px 60px 80px", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 12, background: isSelected ? T.brand100 : "#fff" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: T.ink, fontSize: 13 }}>{r.sahip}</div>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{r.st}</div>
                  </div>
                  <div style={{ color: T.ink }}>{r.kurum}</div>
                  <div style={{ color: T.ink2 }}>{r.hiz}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11, color: T.ink2 }}>{r.no}</div>
                  <div style={{ color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.paket}</div>
                  <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: T.brand900 }}>{MoneyTR(r.tutar)}</div>
                  <div>
                    <span style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700, background: r.oto === "Elden" ? T.warning100 : T.info100, color: r.oto === "Elden" ? T.warning500 : T.info500, textTransform: "uppercase" }}>{r.oto}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: dangerTaah ? T.danger500 : T.ink, fontWeight: dangerTaah ? 700 : 500 }}>{r.taah}</div>
                    {r.days !== null && (
                      <div style={{ fontSize: 10, color: dangerTaah ? T.danger500 : T.muted, marginTop: 2 }}>{r.days} gün kaldı</div>
                    )}
                  </div>
                  <div><StatusTag label={r.st2} bg={r.stBg} fg={r.stFg} /></div>
                  <div>{r.gor !== "—" ? <span style={{ display: "inline-flex", padding: "2px 6px", background: T.info100, color: T.info500, borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>📋 {r.gor}</span> : <span style={{ color: T.muted }}>—</span>}</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 12 }}>⋯</button>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>

        {/* SAĞ DRAWER */}
        <div style={{ width: 320, background: T.card, borderLeft: `1px solid ${T.border}`, padding: 16, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Seçili Abonelik</div>
          <div style={{ padding: 12, background: T.orange100, borderRadius: 10, marginBottom: 12, border: `1px solid ${T.orange500}30` }}>
            <StatusTag label="YAKLAŞIYOR" bg="#fff" fg={T.orange500} />
            <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginTop: 8 }}>Turkcell · Süper Plus</div>
            <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>Test Kullanıcı · 0532 318 16 68</div>
            <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Taahhüt Kalan</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.danger500, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>31 gün</div>
              </div>
              <div style={{ height: 6, background: T.border, borderRadius: 9999, marginTop: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "10%", background: T.danger500 }} />
              </div>
              <div style={{ fontSize: 11, color: T.ink2, marginTop: 6 }}>Bitiş: 15.06.2026</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            <Btn variant="primary" size="sm" style={{ justifyContent: "center" }}>🔄 Taahhüt Yenile</Btn>
            <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>+ Görev Oluştur</Btn>
            <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>Detay sayfası →</Btn>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Son 3 Ödeme</div>
          {[
            ["Nisan 2026", 1250.0, T.success500],
            ["Mart 2026", 1250.0, T.success500],
            ["Şubat 2026", 1180.0, T.success500],
          ].map(([m, t, c], i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: i < 2 ? `1px solid ${T.border}` : "none", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: T.ink }}>{m}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: c, fontWeight: 700 }}>{MoneyTR(t)}</span>
            </div>
          ))}

          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 16, marginBottom: 8 }}>Bağlı Görev</div>
          <div style={{ padding: 10, border: `1px solid ${T.border}`, borderRadius: 8, borderLeft: `3px solid ${T.orange500}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Turkcell taahhüt yenile / iptal et</div>
            <div style={{ fontSize: 11, color: T.ink2, marginTop: 4 }}>Atanan: Erdal · Son: 10.06.2026</div>
          </div>

          <div style={{ marginTop: 16, padding: 10, background: T.brand100, borderRadius: 8, fontSize: 11, color: T.brand700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            💬 Bu kayıtla ilgili sohbet aç →
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 9 — 09 SiteX Daire / Aidat Dashboard
   ============================================================ */
function SiteXFrame() {
  const daireler = [
    { kod: "A4.17", sahip: "Test Kullanıcı", t: 18750.0, son: "20.05.2026", ekstre: "OK", dekont: "—", st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, sel: true },
    { kod: "A4.22", sahip: "Mehmet Rahim Acme", t: 17900.0, son: "20.05.2026", ekstre: "OK", dekont: "OK", st: "ÖDENDİ", stBg: T.success100, stFg: T.success500 },
    { kod: "A4.25", sahip: "Mehmet Ali Acme", t: 19420.0, son: "20.05.2026", ekstre: "OK", dekont: "—", st: "DEKONT EKSİK", stBg: T.orange100, stFg: T.orange500 },
    { kod: "B2.28", sahip: "Ali Acme", t: 16800.0, son: "20.05.2026", ekstre: "OK", dekont: "—", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500 },
    { kod: "B3.31", sahip: "Kaan Acme", t: 21250.0, son: "20.05.2026", ekstre: "—", dekont: "—", st: "KONTROL GEREKLİ", stBg: T.purple100, stFg: T.purple500 },
  ];
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  // A4.17 timeline 2026
  const timeline = [
    { ay: 0, t: 17843, st: "OK" }, { ay: 1, t: 17843, st: "OK" }, { ay: 2, t: 24203, st: "OK" },
    { ay: 3, t: 28344, st: "OK" }, { ay: 4, t: 18750, st: "YAKLAŞIYOR" },
    { ay: 5, t: null, st: "—" }, { ay: 6, t: null, st: "—" }, { ay: 7, t: null, st: "—" },
    { ay: 8, t: null, st: "—" }, { ay: 9, t: null, st: "—" }, { ay: 10, t: null, st: "—" }, { ay: 11, t: null, st: "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="pruva" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mülk-Şahıs / SiteX</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>SiteX Daire & Aidat Takibi</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Daire bazlı aylık ekstre, aidat, gider, dekont ve site belgeleri takibi.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">📎 Belge Yükle</Btn>
              <Btn variant="secondary" size="md">⬆ Ekstre Import</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Ödeme</Btn>
            </div>
          </div>

          {/* KURAL ROZETİ */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", background: T.brand100, color: T.brand700, borderRadius: 9999, fontSize: 12, fontWeight: 700, marginBottom: 18, border: `1px solid ${T.brand300}` }}>
            <span style={{ width: 24, height: 24, borderRadius: 9999, background: T.brand700, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>20</span>
            <span>SiteX Kuralı: Her ayın 20'si son ödeme · T-3 görev otomatik üretilir</span>
          </div>

          {/* 5 DAİRE KARTI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 18 }}>
            {daireler.map((d) => (
              <Card key={d.kod} pad={14} style={{ borderTop: `4px solid ${d.sel ? T.brand700 : T.border}`, position: "relative", cursor: "pointer", boxShadow: d.sel ? "0 6px 16px rgba(15,37,64,0.10)" : undefined }}>
                {d.sel && <div style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 9999, background: T.brand700 }} />}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.brand900, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{d.kod}</div>
                  <StatusTag label={d.st} bg={d.stBg} fg={d.stFg} />
                </div>
                <div style={{ fontSize: 12, color: T.ink2, marginBottom: 10 }}>{d.sahip}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.brand900, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{MoneyTR(d.t)}</div>
                <div style={{ fontSize: 11, color: T.ink2, marginTop: 4 }}>Son ödeme: {d.son}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: 10 }}>
                  <span style={{ flex: 1, padding: "4px 6px", textAlign: "center", borderRadius: 6, background: d.ekstre === "OK" ? T.success100 : T.danger100, color: d.ekstre === "OK" ? T.success500 : T.danger500, fontWeight: 700 }}>📄 Ekstre {d.ekstre}</span>
                  <span style={{ flex: 1, padding: "4px 6px", textAlign: "center", borderRadius: 6, background: d.dekont === "OK" ? T.success100 : T.warning100, color: d.dekont === "OK" ? T.success500 : T.warning500, fontWeight: 700 }}>🧾 Dekont {d.dekont}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* SEÇİLİ DAİRE TIMELINE + SAĞ PANEL */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, marginBottom: 16 }}>
            <Card pad={0}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Seçili Daire</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.brand900, marginTop: 2 }}>A4.17 · Test Kullanıcı</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["2024", "2025", "2026"].map((y) => (
                    <div key={y} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: y === "2026" ? T.brand700 : "transparent", color: y === "2026" ? "#fff" : T.ink2, border: y === "2026" ? "none" : `1px solid ${T.border}`, cursor: "pointer" }}>{y}</div>
                  ))}
                </div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 6 }}>
                  {months.map((m, i) => {
                    const t = timeline[i];
                    const colors = {
                      "OK": { bg: T.success100, fg: T.success500, border: T.success500 },
                      "YAKLAŞIYOR": { bg: T.orange100, fg: T.orange500, border: T.orange500 },
                      "—": { bg: "#fff", fg: T.muted, border: T.border },
                    };
                    const c = colors[t.st];
                    return (
                      <div key={m} style={{ padding: 10, border: `1.5px solid ${c.border}`, borderRadius: 8, background: c.bg, textAlign: "center", minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: c.fg, textTransform: "uppercase" }}>{m}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: c.fg, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{t.t === null ? "—" : (t.t / 1000).toFixed(1) + "K"}</div>
                        <div style={{ display: "flex", justifyContent: "center", gap: 4, fontSize: 9 }}>
                          {t.t !== null && <span title="Ekstre">📄</span>}
                          {t.st === "OK" && <span title="Dekont">🧾</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 11, color: T.ink2 }}>
                  <span>● <b style={{ color: T.success500 }}>Ödendi</b> 4</span>
                  <span>● <b style={{ color: T.orange500 }}>Yaklaşan</b> 1</span>
                  <span>● <b style={{ color: T.muted }}>Beklenen</b> 7</span>
                </div>
              </div>
            </Card>

            {/* SAĞ PANEL — SEÇİLİ AY ÖZETİ */}
            <Card pad={0}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.brand100 }}>
                <div style={{ fontSize: 11, color: T.brand500, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Seçili Ay</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.brand900, marginTop: 2 }}>Mayıs 2026</div>
              </div>
              <div style={{ padding: 16 }}>
                {[
                  ["Aidat", 17843.0, T.brand900],
                  ["Gider", 1864.0, T.brand900],
                  ["Geçmiş Borç", 0, T.muted],
                  ["TOPLAM", 19707.0, T.danger500],
                ].map(([l, t, c], i) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none", borderTop: i === 3 ? `2px solid ${T.brand900}` : "none", paddingTop: i === 3 ? 12 : 8 }}>
                    <span style={{ fontSize: 12, fontWeight: i === 3 ? 700 : 500, color: i === 3 ? T.brand900 : T.ink2, textTransform: i === 3 ? "uppercase" : "none", letterSpacing: i === 3 ? "0.06em" : "0" }}>{l}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, fontSize: i === 3 ? 16 : 13, color: c }}>{MoneyTR(t)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: 10, background: T.orange100, borderRadius: 8, fontSize: 12, color: T.orange500, fontWeight: 600 }}>
                  📅 Son ödeme: <b>20.05.2026</b> · 6 gün kaldı
                </div>
                <div style={{ marginTop: 12, padding: 10, border: `1px solid ${T.border}`, borderRadius: 8, background: T.danger100, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, background: T.danger500, color: "#fff", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800 }}>PDF</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>A4.17 — 2026-05 Ekstre</div>
                    <div style={{ fontSize: 10, color: T.ink2 }}>248 KB · indirildi</div>
                  </div>
                  <button style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12 }}>👁</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                  <Btn variant="primary" size="sm" style={{ justifyContent: "center" }}>📎 Dekont Yükle</Btn>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>+ Görev Oluştur</Btn>
                  <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>💬 Chat aç</Btn>
                </div>
              </div>
            </Card>
          </div>

          {/* ALT 2 BÖLÜM */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
            {/* AİDAT FARKLARI */}
            <Card pad={0}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900 }}>Aidat Farkları · Şahıslara Yatan Paralar</div>
                <Btn variant="ghost" size="sm">+ Mutabakat</Btn>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 130px 130px 110px 80px", gap: 10, padding: "10px 20px", background: "#FAFBFC", fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
                <div>Daire / Şahıs</div><div>Dönem</div><div style={{ textAlign: "right" }}>Beklenen</div><div style={{ textAlign: "right" }}>Yatan</div><div>Durum</div><div>Aksiyon</div>
              </div>
              {[
                ["A4.17 · Test Kullanıcı", "2026-04", 28344, 28344, "MUTABIK", T.success100, T.success500],
                ["B3.31 · Kaan Acme", "2026-04", 28344, 26500, "FARK VAR (-1.844)", T.danger100, T.danger500],
                ["A4.25 · Mehmet Ali Acme", "2026-03", 24203, 24500, "FAZLA YATAN (+297)", T.purple100, T.purple500],
                ["B2.28 · Ali Acme", "2026-03", 24203, 24203, "MUTABIK", T.success100, T.success500],
              ].map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 130px 130px 110px 80px", gap: 10, padding: "12px 20px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 12 }}>
                  <div style={{ color: T.ink, fontWeight: 600 }}>{r[0]}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: T.ink2 }}>{r[1]}</div>
                  <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: T.ink }}>{MoneyTR(r[2])}</div>
                  <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: r[6] }}>{MoneyTR(r[3])}</div>
                  <div><StatusTag label={r[4]} bg={r[5]} fg={r[6]} /></div>
                  <div><Btn variant="ghost" size="sm">Aç</Btn></div>
                </div>
              ))}
            </Card>

            {/* SİTE BELGELERİ */}
            <Card pad={0}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900 }}>Site Belgeleri Arşivi</div>
                <Btn variant="ghost" size="sm">+ Yükle</Btn>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["📊", "2026 Avans İşletme Bütçesi", "Mart 2026", T.info500],
                  ["🔍", "2025 Bağımsız Denetim Raporu", "Mart 2026", T.success500],
                  ["📋", "Genel Kurul Toplantı Tutanağı", "2024-03", T.brand500],
                  ["📑", "Tapu / Bağımsız Bölüm", "—", T.muted],
                  ["📈", "2025 İşletme Maliyetleri", "Mart 2026", T.purple500],
                ].map(([ic, t, d, c], i) => (
                  <div key={i} style={{ padding: 10, border: `1px solid ${T.border}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10, background: "#fff" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${c}20`, color: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{ic}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{d}</div>
                    </div>
                    <button style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12 }}>👁</button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 10 — 10 Emlak Vergisi / Mülk Takip
   ============================================================ */
function EmlakFrame() {
  const kpis = [
    { l: "Takip Edilen Mülk", v: "12", c: T.brand900 },
    { l: "2026 Toplam Tahakkuk", v: MoneyTR(485220.4), c: T.brand700, mono: true },
    { l: "Bekleyen Taksit", v: "8", c: T.warning500 },
    { l: "Geciken Taksit", v: "3", c: T.danger500 },
    { l: "Eksik Makbuz", v: "5", c: T.orange500 },
    { l: "Kontrol Gerekli", v: "2", c: T.purple500 },
  ];
  // Mülk × yıl/taksit
  const cell = (t, st) => ({ t, st });
  const C = {
    OK: { bg: T.success100, fg: T.success500, label: "ÖDENDİ" },
    BEK: { bg: T.warning100, fg: T.warning500, label: "BEKLİYOR" },
    GEC: { bg: T.danger100, fg: T.danger500, label: "GECİKTİ" },
    YAK: { bg: T.orange100, fg: T.orange500, label: "YAKLAŞAN" },
    NA: { bg: "#F1F3F5", fg: T.muted, label: "—" },
  };

  const mulkler = [
    { ad: "SiteX A4.17", sahip: "Test Kullanıcı", bld: "Bakırköy", cells: [cell(2150, "OK"), cell(2150, "OK"), cell(3450, "OK"), cell(3450, "OK"), cell(5240, "BEK"), cell(5240, "NA")] },
    { ad: "Bayrampaşa Mega Center", sahip: "Acme Tekstil", bld: "Bayrampaşa", cells: [cell(28086, "OK"), cell(28086, "OK"), cell(48672, "OK"), cell(48672, "OK"), cell(56172, "GEC"), cell(56172, "NA")], sel: true },
    { ad: "Fatih İş Yeri", sahip: "Mehmet Rahim Acme", bld: "Fatih", cells: [cell(1450, "OK"), cell(1450, "OK"), cell(1850, "OK"), cell(1850, "OK"), cell(2300, "OK"), cell(2300, "BEK")] },
    { ad: "Yalova Termal", sahip: "Ali Acme", bld: "Termal", cells: [cell(840, "OK"), cell(840, "OK"), cell(1120, "OK"), cell(1120, "OK"), cell(1450, "YAK"), cell(1450, "NA")] },
    { ad: "Bakırköy Daire", sahip: "Mehmet Ali Acme", bld: "Bakırköy", cells: [cell(1850, "OK"), cell(1850, "OK"), cell(2450, "OK"), cell(2450, "OK"), cell(3120, "GEC"), cell(3120, "NA")] },
    { ad: "Beyoğlu / MakYapı", sahip: "MakYapı A.Ş.", bld: "Beyoğlu", cells: [cell(48595, "OK"), cell(48595, "OK"), cell(72893, "OK"), cell(72893, "OK"), cell(97191, "GEC"), cell(97191, "NA")] },
    { ad: "Manisa Şehzadeler", sahip: "Beta Tekstil", bld: "M.Şehzadeler", cells: [cell(18080, "OK"), cell(18080, "OK"), cell(28160, "OK"), cell(28160, "OK"), cell(36160, "OK"), cell(36160, "BEK")] },
  ];

  const cols = ["2024 D1", "2024 D2", "2025 D1", "2025 D2", "2026 D1", "2026 D2"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="emlak" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mülk-Şahıs / Emlak Vergisi</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Emlak Vergisi & Mülk Takibi</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Şirket ve şahıs mülkleri için belediye, yıl, taksit, makbuz ve ödeme takibi.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">📎 Makbuz Yükle</Btn>
              <Btn variant="secondary" size="md">⬆ Emlak Import</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Mülk</Btn>
            </div>
          </div>

          {/* TAKSİT KURAL ROZETİ */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", background: T.brand100, color: T.brand700, borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 22, height: 22, borderRadius: 9999, background: T.brand700, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>1</span>
              <span>1. Taksit · Son: <b>31.05.2026</b></span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", background: T.bg, color: T.ink2, borderRadius: 9999, fontSize: 12, fontWeight: 700, border: `1px solid ${T.border}` }}>
              <span style={{ width: 22, height: 22, borderRadius: 9999, background: T.muted, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>2</span>
              <span>2. Taksit · Son: <b>30.11.2026</b></span>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.c, marginTop: 6, fontFamily: k.mono ? "'IBM Plex Mono', ui-monospace, monospace" : "inherit" }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* FILTER */}
          <Card pad={14} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", flex: "1 1 240px", minWidth: 220, color: T.muted, fontSize: 13 }}>
                {Ico.search}<span>Mülk, sahip, sicil no, belediye...</span>
              </div>
              {["Tip: Tümü ▾", "Sahip: Tümü ▾", "Belediye: Tümü ▾", "İl/İlçe: Tümü ▾", "Yıl: 2026 ▾", "Taksit: Tümü ▾", "Durum: Tümü ▾", "Makbuz: Tümü ▾"].map((c) => (
                <div key={c} style={{ height: 32, padding: "0 10px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 12, color: T.ink2 }}>{c}</div>
              ))}
              <Btn variant="ghost" size="sm">Temizle</Btn>
            </div>
          </Card>

          {/* GRID + DRAWER */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
            <Card pad={0} style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900 }}>Mülk × Yıl/Taksit Grid</div>
                <div style={{ fontSize: 11, color: T.ink2 }}>Sticky 1. kolon · 7 mülk gösteriliyor</div>
              </div>

              {/* HEADER */}
              <div style={{ display: "grid", gridTemplateColumns: "260px 130px repeat(6, 110px) 90px 90px", gap: 0, background: "#FAFBFC", fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ padding: "10px 14px", borderRight: `2px solid ${T.border}`, position: "sticky", left: 0, background: "#FAFBFC", zIndex: 2 }}>Mülk / Sahip</div>
                <div style={{ padding: "10px 10px", borderRight: `1px solid ${T.border}` }}>Belediye</div>
                {cols.map((c, i) => (
                  <div key={c} style={{ padding: "10px 8px", textAlign: "center", borderRight: `1px solid ${T.border}`, background: i === 4 ? T.brand100 : undefined, color: i === 4 ? T.brand700 : T.ink2 }}>{c}</div>
                ))}
                <div style={{ padding: "10px 8px", textAlign: "center", borderRight: `1px solid ${T.border}` }}>Belge</div>
                <div style={{ padding: "10px 8px", textAlign: "center" }}>Aksiyon</div>
              </div>

              {/* ROWS */}
              {mulkler.map((m, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "260px 130px repeat(6, 110px) 90px 90px", gap: 0, borderBottom: `1px solid ${T.border}`, fontSize: 12, background: m.sel ? T.brand100 : "#fff" }}>
                  <div style={{ padding: "12px 14px", borderRight: `2px solid ${T.border}`, position: "sticky", left: 0, background: m.sel ? T.brand100 : "#fff", zIndex: 1 }}>
                    <div style={{ fontWeight: 700, color: T.ink, fontSize: 13 }}>{m.ad}</div>
                    <div style={{ fontSize: 11, color: T.ink2, marginTop: 2 }}>{m.sahip}</div>
                  </div>
                  <div style={{ padding: "12px 10px", borderRight: `1px solid ${T.border}`, color: T.ink2, fontSize: 12 }}>{m.bld}</div>
                  {m.cells.map((c, ci) => {
                    const cs = C[c.st];
                    return (
                      <div key={ci} style={{ padding: "10px 6px", borderRight: `1px solid ${T.border}`, background: c.st === "NA" ? "#FAFBFC" : "transparent", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                        {c.st !== "NA" ? (
                          <>
                            <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11, fontWeight: 700, color: cs.fg }}>{MoneyTR(c.t).replace("₺ ", "")}</div>
                            <div style={{ display: "inline-block", padding: "1px 5px", borderRadius: 9999, fontSize: 8, fontWeight: 800, background: cs.bg, color: cs.fg, textTransform: "uppercase", letterSpacing: "0.04em" }}>{cs.label}</div>
                          </>
                        ) : (
                          <span style={{ color: T.muted, fontSize: 14 }}>—</span>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ padding: "12px 6px", borderRight: `1px solid ${T.border}`, textAlign: "center", display: "flex", justifyContent: "center", gap: 3 }}>
                    <span title="Borç dökümü" style={{ fontSize: 14, color: T.danger500 }}>📄</span>
                    <span title="Makbuz" style={{ fontSize: 14, color: T.success500 }}>🧾</span>
                  </div>
                  <div style={{ padding: "12px 6px", textAlign: "center" }}>
                    <button style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 12 }}>⋯</button>
                  </div>
                </div>
              ))}
            </Card>

            {/* SAĞ DRAWER — Mülk Detay */}
            <Card pad={0} style={{ height: "fit-content", position: "sticky", top: 0 }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.brand100 }}>
                <StatusTag label="GECİKTİ" bg={T.danger100} fg={T.danger500} pulse />
                <div style={{ fontSize: 16, fontWeight: 700, color: T.brand900, marginTop: 8 }}>Bayrampaşa Mega Center</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>Acme Tekstil · Bayrampaşa Belediyesi</div>
              </div>
              <div style={{ padding: 16 }}>
                {[
                  ["Vergi No", "836 007 7353"],
                  ["Sicil No", "3012291"],
                  ["Ada / Parsel", "—"],
                  ["Bağ. Bölüm", "—"],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
                    <span style={{ color: T.ink2 }}>{l}</span>
                    <span style={{ color: T.ink, fontWeight: 600, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{v}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: 12, background: T.danger100, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.danger500, textTransform: "uppercase", letterSpacing: "0.06em" }}>2026 1. Taksit · GECİKTİ</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.danger500, marginTop: 6, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{MoneyTR(56172.6)}</div>
                  <div style={{ fontSize: 11, color: T.ink2, marginTop: 4 }}>Son ödeme: 31.05.2026 — <b style={{ color: T.danger500 }}>Bugün -5 gün</b></div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 16, marginBottom: 8 }}>Belgeler</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    ["📄 Borç Dökümü 2026", "PDF · 156 KB", T.danger500],
                    ["🧾 Makbuz 2025-D2", "PDF · 89 KB", T.success500],
                  ].map(([t, d, c], i) => (
                    <div key={i} style={{ padding: 8, border: `1px solid ${T.border}`, borderRadius: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</div>
                        <div style={{ color: T.muted, fontSize: 10 }}>{d}</div>
                      </div>
                      <button style={{ width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: 10 }}>👁</button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                  <Btn variant="primary" size="sm" style={{ justifyContent: "center" }}>✓ Ödeme Bağla</Btn>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>📎 Makbuz Yükle</Btn>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>+ Görev Oluştur</Btn>
                  <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>💬 Chat aç</Btn>
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Audit (Son 2)</div>
                  <div style={{ fontSize: 11, color: T.ink2, lineHeight: 1.7 }}>
                    <div><b style={{ color: T.brand700 }}>Sistem</b> · görev oluşturdu · 28.05 09:00</div>
                    <div><b style={{ color: T.brand700 }}>Erdal</b> · borç dökümü yükledi · 18.05 11:24</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 11 — 11 Teminat Mektupları Takip
   ============================================================ */
function TeminatFrame() {
  const kpis = [
    { l: "Aktif Teminat", v: "14", c: T.brand900 },
    { l: "Toplam Aktif Tutar", v: MoneyTR(4836000.0), c: T.brand700, mono: true },
    { l: "Bu Ay Komisyon", v: MoneyTR(48720.0), c: T.orange500, mono: true },
    { l: "Geciken Komisyon", v: "1", c: T.danger500 },
    { l: "İade Bekleyen", v: "2", c: T.info500 },
    { l: "Kontrol Gerekli", v: "1", c: T.purple500 },
  ];
  const rows = [
    { sirket: "Acme Enerji", banka: "Albaraka", no: "71-D8-3842", tip: "Elektronik", kurum: "TEİAŞ", is: "Kısık HES", tutar: 2000000, oran: 0.8, per: "Yıllık", son: "12.05.2026", st: "KOMİSYON YAKLAŞAN", stBg: T.orange100, stFg: T.orange500, sel: true },
    { sirket: "Acme Enerji", banka: "Garanti", no: "102938", tip: "Fiziki", kurum: "EPİAŞ", is: "Genel", tutar: 16000, oran: 0.4, per: "Tek Sefer", son: "—", st: "AKTİF", stBg: T.success100, stFg: T.success500 },
    { sirket: "Beta Tekstil", banka: "Yapı Kredi", no: "88912", tip: "Fiziki", kurum: "CK Boğaziçi", is: "Elektrik Perakende", tutar: 350000, oran: 0.45, per: "3 Aylık", son: "08.05.2026", st: "GECİKTİ", stBg: T.danger100, stFg: T.danger500 },
    { sirket: "Acme Tekstil", banka: "Albaraka", no: "77-A-221", tip: "Elektronik", kurum: "EPDK", is: "Genel", tutar: 750000, oran: 0.7, per: "Yıllık", son: "20.07.2026", st: "YENİLENDİ", stBg: T.info100, stFg: T.info500 },
    { sirket: "MDT", banka: "Garanti", no: "55-B-992", tip: "Fiziki", kurum: "Osmangazi Elektrik", is: "Doğal Gaz Tesisat", tutar: 120000, oran: 0.5, per: "Aylık", son: "—", st: "İADE EDİLDİ", stBg: "#F1F3F5", stFg: T.muted },
    { sirket: "Acme Tekstil", banka: "Garanti", no: "1510023", tip: "Fiziki", kurum: "CK Boğaziçi", is: "Elektrik", tutar: 5500, oran: 0.6, per: "3 Aylık", son: "14.08.2026", st: "AKTİF", stBg: T.success100, stFg: T.success500 },
    { sirket: "Beta Tekstil", banka: "Albaraka", no: "71-D8-3833", tip: "Fiziki", kurum: "CK Boğaziçi", is: "Perakende Satış", tutar: 64600, oran: 0.5, per: "3 Aylık", son: "28.07.2026", st: "AKTİF", stBg: T.success100, stFg: T.success500 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="teminat" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Resmi-Banka / Teminat Mektupları</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Teminat Mektupları</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Banka teminatları, komisyon periyotları, iade/yenileme ve belge takibi.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">📅 Komisyon Takvimi</Btn>
              <Btn variant="secondary" size="md">⬆ Excel Import</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Teminat</Btn>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.c, marginTop: 6, fontFamily: k.mono ? "'IBM Plex Mono', ui-monospace, monospace" : "inherit" }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* BANKA RİSK + KOMİSYON DAĞILIM */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 16 }}>
            <Card pad={16}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 12 }}>Banka Bazlı Toplam Risk</div>
              {[
                ["Albaraka", 2766000, 57, T.brand700],
                ["Garanti", 891500, 18, T.success500],
                ["Yapı Kredi", 350000, 7, T.warning500],
                ["İş Bankası", 528500, 11, T.info500],
                ["Vakıfbank", 300000, 7, T.purple500],
              ].map(([n, t, p, c]) => (
                <div key={n} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: T.ink, fontWeight: 600 }}>{n}</span>
                    <span style={{ color: T.ink2, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{MoneyTR(t)} <span style={{ color: T.muted }}>· %{p}</span></span>
                  </div>
                  <div style={{ height: 8, background: T.border, borderRadius: 9999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p}%`, background: c }} />
                  </div>
                </div>
              ))}
            </Card>
            <Card pad={16}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 12 }}>Komisyon Periyodu Dağılımı</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                {[
                  ["Yıllık", 6, T.info500, T.info100],
                  ["3 Aylık", 4, T.success500, T.success100],
                  ["Aylık", 2, T.warning500, T.warning100],
                  ["Tek Sefer", 2, T.muted, "#F1F3F5"],
                ].map(([l, n, c, b]) => (
                  <div key={l} style={{ padding: 12, background: b, borderRadius: 8, borderLeft: `3px solid ${c}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: T.brand900, marginTop: 2, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{n}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* FILTER */}
          <Card pad={14} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", flex: "1 1 240px", minWidth: 220, color: T.muted, fontSize: 13 }}>
                {Ico.search}<span>Mektup no, kurum, şirket...</span>
              </div>
              {["Şirket: Tümü ▾", "Banka: Tümü ▾", "Kurum: Tümü ▾", "Tip: Tümü ▾", "Periyot: Tümü ▾", "Durum: Tümü ▾"].map((c) => (
                <div key={c} style={{ height: 32, padding: "0 10px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 12, color: T.ink2 }}>{c}</div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 8, background: T.orange100, color: T.orange500, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 28, height: 16, background: T.orange500, borderRadius: 9999, position: "relative" }}>
                  <span style={{ position: "absolute", right: 2, top: 2, width: 12, height: 12, background: "#fff", borderRadius: 9999 }} />
                </span>
                Komisyon yaklaşan
              </div>
              <Btn variant="ghost" size="sm">Temizle</Btn>
            </div>
          </Card>

          {/* TABLO + DRAWER */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
            <Card pad={0}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 80px 100px 100px 130px 70px 90px 130px 130px 60px", gap: 6, padding: "10px 14px", background: "#FAFBFC", fontSize: 9, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
                <div>Şirket</div><div>Banka</div><div>Mektup No</div><div>Tip</div><div>Kurum</div><div>İş</div><div style={{ textAlign: "right" }}>Tutar</div><div>%</div><div>Periyot</div><div>Sonraki Kom.</div><div>Durum</div><div></div>
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 80px 100px 100px 130px 70px 90px 130px 130px 60px", gap: 6, padding: "12px 14px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 11, background: r.sel ? T.brand100 : "#fff" }}>
                  <div style={{ fontWeight: 600, color: T.ink, fontSize: 12 }}>{r.sirket}</div>
                  <div style={{ color: T.ink }}>{r.banka}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 10, color: T.ink2 }}>{r.no}</div>
                  <div>
                    <span style={{ padding: "2px 6px", borderRadius: 9999, fontSize: 9, fontWeight: 700, background: r.tip === "Elektronik" ? T.info100 : T.warning100, color: r.tip === "Elektronik" ? T.info500 : T.warning500, textTransform: "uppercase" }}>{r.tip === "Elektronik" ? "E" : "F"} {r.tip}</span>
                  </div>
                  <div style={{ color: T.ink }}>{r.kurum}</div>
                  <div style={{ color: T.ink2, fontSize: 11 }}>{r.is}</div>
                  <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: T.brand900 }}>{MoneyTR(r.tutar)}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: T.ink2, fontSize: 11 }}>%{r.oran.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: T.ink2 }}>{r.per}</div>
                  <div style={{ fontSize: 11, color: r.son.includes("05.") ? T.danger500 : T.ink, fontWeight: r.son.includes("05.") ? 700 : 500 }}>{r.son}</div>
                  <div><StatusTag label={r.st} bg={r.stBg} fg={r.stFg} pulse={r.st === "GECİKTİ"} /></div>
                  <div style={{ display: "flex", gap: 3 }}>
                    <span title="Mektup PDF" style={{ fontSize: 14, color: T.danger500, cursor: "pointer" }}>📄</span>
                    <button style={{ width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 11 }}>⋯</button>
                  </div>
                </div>
              ))}
            </Card>

            {/* DRAWER */}
            <Card pad={0} style={{ height: "fit-content", position: "sticky", top: 0 }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.orange100 }}>
                <StatusTag label="KOMİSYON YAKLAŞAN" bg="#fff" fg={T.orange500} />
                <div style={{ fontSize: 15, fontWeight: 700, color: T.brand900, marginTop: 8 }}>Albaraka · 71-D8-3842</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>Acme Enerji · TEİAŞ · Kısık HES</div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Tutar</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.brand900, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{MoneyTR(2000000)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Komisyon Oranı</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.brand900, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>%0,80</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Yıllık Komisyon</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.warning500, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{MoneyTR(16000)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Periyot</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Yıllık</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Komisyon Timeline</div>
                <div style={{ position: "relative", paddingLeft: 18, marginBottom: 14 }}>
                  <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 2, background: T.border }} />
                  {[
                    ["12.05.2026", "Yaklaşan ödeme", T.orange500, MoneyTR(16000)],
                    ["12.05.2025", "Ödendi · EFT", T.success500, MoneyTR(14000)],
                    ["12.05.2024", "Ödendi · EFT", T.success500, MoneyTR(12000)],
                  ].map(([d, t, c, m], i) => (
                    <div key={i} style={{ position: "relative", paddingBottom: 10 }}>
                      <div style={{ position: "absolute", left: -16, top: 4, width: 10, height: 10, borderRadius: 9999, background: c, border: "2px solid #fff", boxShadow: `0 0 0 2px ${c}` }} />
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.ink }}>{d}</div>
                      <div style={{ fontSize: 11, color: T.ink2 }}>{t} · <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: T.brand900, fontWeight: 600 }}>{m}</span></div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Belgeler</div>
                <div style={{ padding: 8, border: `1px solid ${T.border}`, borderRadius: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 11, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, background: T.danger500, color: "#fff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800 }}>PDF</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>71-D8-3842 Mektup.pdf</div>
                    <div style={{ color: T.muted }}>312 KB</div>
                  </div>
                  <button style={{ width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: 10 }}>👁</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                  <Btn variant="primary" size="sm" style={{ justifyContent: "center" }}>✓ Komisyon Öde</Btn>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>🔄 Mektup Yenile</Btn>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>↩ İade Et</Btn>
                  <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>+ Görev / 💬 Chat</Btn>
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.ink2, lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>Audit (Son 2)</div>
                  <div><b style={{ color: T.brand700 }}>Sistem</b> · komisyon hatırlatma · 05.05 09:00</div>
                  <div><b style={{ color: T.brand700 }}>Müdür</b> · mektup yenileme · 12.05.2025</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 12 — 12 Resmi Ödemeler / BAĞKUR / SSK / İTO / BES
   ============================================================ */
function ResmiOdemelerFrame() {
  const kpis = [
    { l: "Bu Ay Resmi", v: MoneyTR(312420.45), c: T.brand900, mono: true },
    { l: "Geciken", v: "2", c: T.danger500 },
    { l: "Yaklaşan İTO/BAĞKUR", v: "5", c: T.orange500 },
    { l: "Eksik Dekont", v: "3", c: T.warning500 },
    { l: "Kontrol Gerekli", v: "1", c: T.purple500 },
    { l: "Yıllık Toplam", v: MoneyTR(2840560.0), c: T.brand700, mono: true },
  ];

  const kategoriler = [
    { k: "BAĞKUR", c: 5, t: 40602.25, ic: "👤", color: T.info500, bg: T.info100, sel: true },
    { k: "SSK", c: 3, t: 184220.0, ic: "🏥", color: T.brand700, bg: T.brand100 },
    { k: "BES", c: 4, t: 71500.0, ic: "💰", color: T.purple500, bg: T.purple100 },
    { k: "İTO Aidatı", c: 8, t: 38600.0, ic: "🏛", color: T.warning500, bg: T.warning100 },
    { k: "Vergi/Resmi", c: 6, t: 48720.0, ic: "📋", color: T.success500, bg: T.success100 },
  ];

  const rows = [
    { tip: "BAĞKUR", sahip: "Test Kullanıcı", per: "2026-05", son: "31.05.2026", tutar: 8120.45, met: "OTOMATIK", st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, dek: "—", gor: "1", sel: true },
    { tip: "BAĞKUR", sahip: "Ali Acme", per: "2026-05", son: "31.05.2026", tutar: 8120.45, met: "EFT", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, dek: "—", gor: "—" },
    { tip: "BAĞKUR", sahip: "Mehmet Rahim Acme", per: "2026-05", son: "31.05.2026", tutar: 8120.45, met: "OTOMATIK", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, dek: "—", gor: "—" },
    { tip: "BAĞKUR", sahip: "Tal'in Acme", per: "2026-05", son: "31.05.2026", tutar: 8120.45, met: "OTOMATIK", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, dek: "—", gor: "—" },
    { tip: "BAĞKUR", sahip: "Mehriban Acme", per: "2026-05", son: "31.05.2026", tutar: 8120.45, met: "OTOMATIK", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, dek: "—", gor: "—" },
    { tip: "SSK", sahip: "Acme Enerji", per: "2026-05", son: "26.06.2026", tutar: 184220.0, met: "EFT", st: "TASLAK", stBg: T.info100, stFg: T.info500, dek: "—", gor: "1" },
    { tip: "BES", sahip: "Beta Tekstil", per: "2026-05", son: "20.05.2026", tutar: 42800.0, met: "OTOMATIK", st: "ÖDENDİ", stBg: T.success100, stFg: T.success500, dek: "OK", gor: "—" },
    { tip: "İTO", sahip: "Acme Tekstil", per: "2026 1.Tk", son: "30.06.2026", tutar: 12500.0, met: "EFT", st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, dek: "—", gor: "1" },
    { tip: "İTO", sahip: "MakYapı Otelcilik", per: "2026 1.Tk", son: "30.06.2026", tutar: 13200.0, met: "EFT", st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, dek: "—", gor: "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="resmi" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Resmi-Banka / Resmi Ödemeler</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Resmi Ödemeler</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>BAĞKUR, SSK, BES, İTO ve resmi ödeme taksitlerinin merkezi takibi.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">📅 Taksit Takvimi</Btn>
              <Btn variant="secondary" size="md">⬆ Excel Import</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Resmi Ödeme</Btn>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.c, marginTop: 6, fontFamily: k.mono ? "'IBM Plex Mono', ui-monospace, monospace" : "inherit" }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* KATEGORİ KARTLARI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
            {kategoriler.map((k) => (
              <Card key={k.k} pad={14} style={{ borderLeft: `3px solid ${k.color}`, cursor: "pointer", boxShadow: k.sel ? "0 6px 16px rgba(15,37,64,0.10)" : undefined, background: k.sel ? k.bg : T.card, position: "relative" }}>
                {k.sel && <div style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 9999, background: k.color }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{k.ic}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900 }}>{k.k}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Bu ay</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.ink2, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{k.c} kayıt</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Toplam</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.brand900, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{MoneyTR(k.t)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* FILTER */}
          <Card pad={14} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", flex: "1 1 220px", minWidth: 200, color: T.muted, fontSize: 13 }}>
                {Ico.search}<span>Kişi, şirket, dönem...</span>
              </div>
              {["Tip: BAĞKUR ▾", "Sahip: Tümü ▾", "Yıl: 2026 ▾", "Dönem: 05 ▾", "Durum: Tümü ▾", "Yöntem: Tümü ▾", "Dekont: Tümü ▾"].map((c) => (
                <div key={c} style={{ height: 32, padding: "0 10px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 12, color: T.ink2 }}>{c}</div>
              ))}
              <Btn variant="ghost" size="sm">Temizle</Btn>
            </div>
          </Card>

          {/* TABLO + DRAWER */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
            <Card pad={0}>
              <div style={{ display: "grid", gridTemplateColumns: "90px 1.4fr 100px 110px 130px 110px 130px 90px 60px 60px", gap: 6, padding: "10px 14px", background: "#FAFBFC", fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
                <div>Tip</div><div>Sahip</div><div>Dönem</div><div>Son Ödeme</div><div style={{ textAlign: "right" }}>Tutar</div><div>Yöntem</div><div>Durum</div><div>Dekont</div><div>Görev</div><div></div>
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 1.4fr 100px 110px 130px 110px 130px 90px 60px 60px", gap: 6, padding: "12px 14px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 12, background: r.sel ? T.brand100 : "#fff" }}>
                  <div>
                    <span style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 9, fontWeight: 800, background: T.info100, color: T.info500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{r.tip}</span>
                  </div>
                  <div style={{ fontWeight: 600, color: T.ink, fontSize: 13 }}>{r.sahip}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11, color: T.ink2 }}>{r.per}</div>
                  <div style={{ fontSize: 12, color: T.ink2 }}>{r.son}</div>
                  <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: T.brand900 }}>{MoneyTR(r.tutar)}</div>
                  <div><PayMethodTag method={r.met} /></div>
                  <div><StatusTag label={r.st} bg={r.stBg} fg={r.stFg} /></div>
                  <div>{r.dek === "OK" ? <span style={{ color: T.success500, fontWeight: 700, fontSize: 14 }}>✓</span> : <span style={{ color: T.muted }}>—</span>}</div>
                  <div>{r.gor !== "—" ? <span style={{ display: "inline-flex", padding: "2px 6px", background: T.info100, color: T.info500, borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>📋 {r.gor}</span> : <span style={{ color: T.muted }}>—</span>}</div>
                  <div><button style={{ width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 11 }}>⋯</button></div>
                </div>
              ))}
            </Card>

            {/* SAĞ — TAKSİT TAKVİMİ + EKSİK DEKONT + NOTIFICATIONLOG */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Card pad={14}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>Taksit Takvimi</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    ["31.05", "BAĞKUR · 5 kişi", T.orange500],
                    ["20.05", "BES · Beta", T.success500],
                    ["26.06", "SSK · K. Enerji", T.info500],
                    ["30.06", "İTO 1.Tk · 2 şirket", T.orange500],
                    ["31.10", "İTO 2.Tk · 2 şirket", T.muted],
                    ["30.11", "Emlak 2.Tk", T.muted],
                  ].map(([d, l, c], i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 5 ? `1px solid ${T.border}` : "none" }}>
                      <div style={{ width: 4, height: 24, background: c, borderRadius: 2 }} />
                      <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: T.brand900, fontWeight: 700, minWidth: 36 }}>{d}</div>
                      <div style={{ fontSize: 11, color: T.ink, flex: 1 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card pad={14}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>Eksik Dekontlar (3)</div>
                {[
                  ["BAĞKUR · Test · 04.2026", T.warning500],
                  ["SSK · K. Enerji · 04.2026", T.warning500],
                  ["BES · Beta · 03.2026", T.orange500],
                ].map(([t, c], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 2 ? `1px solid ${T.border}` : "none", fontSize: 11 }}>
                    <span style={{ color: T.ink }}>{t}</span>
                    <span style={{ color: c, fontWeight: 700 }}>📎 İste</span>
                  </div>
                ))}
              </Card>

              <Card pad={14}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900 }}>NotificationLog</div>
                  <span style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 9, fontWeight: 800, background: T.warning100, color: T.warning500 }}>DRY-RUN</span>
                </div>
                <div style={{ fontSize: 11, color: T.ink2, lineHeight: 1.7 }}>
                  <div>📤 BAĞKUR T-3 · sistem içi · 09:00</div>
                  <div>📤 İTO T-15 · Telegram dry-run</div>
                  <div>📤 SSK T-7 · sistem içi · 28.05</div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 13 — 13 Düzenli Ödemeler / Kira / SMMM / Hizmetler
   ============================================================ */
function DuzenliOdemelerFrame() {
  const kpis = [
    { l: "Aktif Kalem", v: "32", c: T.brand900 },
    { l: "Bu Ay Beklenen", v: MoneyTR(486250.0), c: T.brand700, mono: true },
    { l: "Geciken", v: "2", c: T.danger500 },
    { l: "Elden Takip", v: "5", c: T.warning500 },
    { l: "Eksik Fat./Dek.", v: "4", c: T.orange500 },
    { l: "Kontrol Gerekli", v: "1", c: T.purple500 },
  ];

  const rows = [
    { ad: "Acme Enerji Merkez Kira", kat: "Kira", sahip: "Acme Enerji", kurum: "Hülya Çetin", per: "Aylık", son: "05.06.2026", tutar: 120000, met: "EFT", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, fat: "OK", gor: "—" },
    { ad: "Beta Merkez Kira", kat: "Kira", sahip: "Beta", kurum: "Mehmet Y.", per: "Aylık", son: "05.06.2026", tutar: 4500, met: "EFT", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, fat: "OK", gor: "—" },
    { ad: "Beta Otel Kira", kat: "Kira", sahip: "Beta", kurum: "Erol B.", per: "Aylık", son: "05.06.2026", tutar: 30000, met: "EFT", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, fat: "—", gor: "1" },
    { ad: "SMMM Hizmeti", kat: "Müşavirlik", sahip: "Acme Tekstil", kurum: "M.A. Müşavirlik", per: "Aylık", son: "10.06.2026", tutar: 25000, met: "EFT", st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, fat: "—", gor: "1", sel: true },
    { ad: "İş Güvenliği OSGB", kat: "Hizmet", sahip: "Beta Tekstil", kurum: "Ortak Sağlık A.Ş.", per: "Aylık", son: "15.06.2026", tutar: 18750, met: "OTOMATIK", st: "ÖDENDİ", stBg: T.success100, stFg: T.success500, fat: "OK", gor: "—" },
    { ad: "Alan Adı Yenileme", kat: "Domain", sahip: "Acme Enerji", kurum: "Natro", per: "Yıllık", son: "01.07.2026", tutar: 3250, met: "KREDİ KARTI", st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, fat: "—", gor: "—" },
    { ad: "Noter Defter Tasdik", kat: "Resmi Hizmet", sahip: "Acme Tekstil", kurum: "5. Noter", per: "Yıllık", son: "—", tutar: 9850, met: "ELDEN", st: "KONTROL GEREKLİ", stBg: T.purple100, stFg: T.purple500, fat: "—", gor: "1" },
    { ad: "K2 Belgesi", kat: "Resmi", sahip: "Beta", kurum: "Ulaştırma B.", per: "5 Yıllık", son: "30.06.2026", tutar: 7200, met: "EFT", st: "DEKONT EKSİK", stBg: T.orange100, stFg: T.orange500, fat: "OK", gor: "1" },
    { ad: "Hosting / Sunucu", kat: "Hizmet", sahip: "Acme Enerji", kurum: "Turhost", per: "Yıllık", son: "12.07.2026", tutar: 8900, met: "KREDİ KARTI", st: "AKTİF", stBg: T.success100, stFg: T.success500, fat: "—", gor: "—" },
    { ad: "Çardak Aidat 275/10", kat: "Aidat", sahip: "KC İplik", kurum: "Site Yönetimi", per: "Aylık", son: "25.05.2026", tutar: 8500, met: "ELDEN", st: "GECİKTİ", stBg: T.danger100, stFg: T.danger500, fat: "—", gor: "1" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="kira" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Şirket / Düzenli Ödemeler</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Düzenli Ödemeler</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Kira, SMMM, iş güvenliği, hizmet ve dönemsel muhasebe ödemeleri.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">📅 Ödeme Takvimi</Btn>
              <Btn variant="secondary" size="md">⬆ Excel Import</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Kalem</Btn>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.c, marginTop: 6, fontFamily: k.mono ? "'IBM Plex Mono', ui-monospace, monospace" : "inherit" }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* FILTER */}
          <Card pad={14} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", flex: "1 1 220px", minWidth: 200, color: T.muted, fontSize: 13 }}>
                {Ico.search}<span>Ödeme adı, sahip, tedarikçi...</span>
              </div>
              {["Kategori: Tümü ▾", "Sahip: Tümü ▾", "Tedarikçi: Tümü ▾", "Periyot: Tümü ▾", "Yöntem: Tümü ▾", "Durum: Tümü ▾"].map((c) => (
                <div key={c} style={{ height: 32, padding: "0 10px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 12, color: T.ink2 }}>{c}</div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 8, background: T.danger100, color: T.danger500, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 28, height: 16, background: T.border, borderRadius: 9999, position: "relative" }}>
                  <span style={{ position: "absolute", left: 2, top: 2, width: 12, height: 12, background: "#fff", borderRadius: 9999 }} />
                </span>
                Sadece Geciken
              </div>
              <Btn variant="ghost" size="sm">Temizle</Btn>
            </div>
          </Card>

          {/* AY MATRİSİ PREVIEW (long-format mantığını gösteren mini görsel) */}
          <Card pad={14} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900 }}>Ay Matrisi (Önizleme) · 2026</div>
                <div style={{ fontSize: 11, color: T.ink2, marginTop: 2 }}>Backend long-format · UI matrix render</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["📋 Liste", false], ["📊 Ay Matrisi", true], ["📅 Takvim", false]].map(([l, a]) => (
                  <div key={l} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: a ? T.brand700 : "transparent", color: a ? "#fff" : T.ink2, cursor: "pointer", border: a ? "none" : `1px solid ${T.border}` }}>{l}</div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px repeat(12,1fr)", gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 8px" }}>Kalem</div>
              {["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"].map((m) => (
                <div key={m} style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textAlign: "center", padding: "6px 4px", textTransform: "uppercase" }}>{m}</div>
              ))}
              {[
                ["K. Enerji Kira", ["OK", "OK", "OK", "OK", "BEK", "—", "—", "—", "—", "—", "—", "—"]],
                ["SMMM K.Tekstil", ["OK", "OK", "OK", "OK", "YAK", "—", "—", "—", "—", "—", "—", "—"]],
                ["İş Güv. Beta", ["OK", "OK", "OK", "OK", "OK", "—", "—", "—", "—", "—", "—", "—"]],
                ["Çardak Aidat", ["OK", "OK", "OK", "OK", "GEC", "—", "—", "—", "—", "—", "—", "—"]],
              ].map(([k, cells], ri) => (
                <React.Fragment key={k}>
                  <div style={{ fontSize: 11, color: T.ink, fontWeight: 600, padding: "6px 8px" }}>{k}</div>
                  {cells.map((c, i) => {
                    const colors = {
                      OK: { bg: T.success100, fg: T.success500 },
                      BEK: { bg: T.warning100, fg: T.warning500 },
                      YAK: { bg: T.orange100, fg: T.orange500 },
                      GEC: { bg: T.danger100, fg: T.danger500 },
                      "—": { bg: "#FAFBFC", fg: T.muted },
                    };
                    const cc = colors[c];
                    return (
                      <div key={i} style={{ aspectRatio: "1.6", background: cc.bg, color: cc.fg, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>{c === "—" ? "" : c}</div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </Card>

          {/* TABLO + DRAWER */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
            <Card pad={0}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 100px 1fr 1fr 80px 110px 130px 110px 130px 80px 60px 50px", gap: 6, padding: "10px 14px", background: "#FAFBFC", fontSize: 9, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
                <div>Ödeme Adı</div><div>Kategori</div><div>Sahip</div><div>Tedarikçi</div><div>Periyot</div><div>Son Ödeme</div><div style={{ textAlign: "right" }}>Tutar</div><div>Yöntem</div><div>Durum</div><div>Fat./Dek.</div><div>Görev</div><div></div>
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 100px 1fr 1fr 80px 110px 130px 110px 130px 80px 60px 50px", gap: 6, padding: "12px 14px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 11, background: r.sel ? T.brand100 : "#fff" }}>
                  <div style={{ fontWeight: 600, color: T.ink, fontSize: 12 }}>{r.ad}</div>
                  <div><span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: T.brand100, color: T.brand700, textTransform: "uppercase" }}>{r.kat}</span></div>
                  <div style={{ color: T.ink, fontSize: 11 }}>{r.sahip}</div>
                  <div style={{ color: T.ink2, fontSize: 11 }}>{r.kurum}</div>
                  <div style={{ fontSize: 11, color: T.ink2 }}>{r.per}</div>
                  <div style={{ fontSize: 11, color: r.st === "GECİKTİ" ? T.danger500 : T.ink2, fontWeight: r.st === "GECİKTİ" ? 700 : 500 }}>{r.son}</div>
                  <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: T.brand900 }}>{MoneyTR(r.tutar)}</div>
                  <div><PayMethodTag method={r.met} /></div>
                  <div><StatusTag label={r.st} bg={r.stBg} fg={r.stFg} pulse={r.st === "GECİKTİ"} /></div>
                  <div>{r.fat === "OK" ? <span style={{ color: T.success500, fontWeight: 700, fontSize: 14 }}>✓</span> : <StatusTag label="EKSİK" bg={T.orange100} fg={T.orange500} />}</div>
                  <div>{r.gor !== "—" ? <span style={{ display: "inline-flex", padding: "2px 6px", background: T.info100, color: T.info500, borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>📋 {r.gor}</span> : <span style={{ color: T.muted }}>—</span>}</div>
                  <div><button style={{ width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 11 }}>⋯</button></div>
                </div>
              ))}
            </Card>

            {/* DRAWER */}
            <Card pad={0} style={{ height: "fit-content" }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.brand100 }}>
                <StatusTag label="YAKLAŞIYOR" bg={T.orange100} fg={T.orange500} />
                <div style={{ fontSize: 15, fontWeight: 700, color: T.brand900, marginTop: 8 }}>SMMM Hizmeti</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>Acme Tekstil · M.A. Müşavirlik</div>
                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.brand500, fontWeight: 700, textTransform: "uppercase" }}>Tutar</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.brand900, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{MoneyTR(25000)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: T.brand500, fontWeight: 700, textTransform: "uppercase" }}>Son Ödeme</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.orange500 }}>10.06.2026</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Son 6 Ay Timeline</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                  {[
                    ["Ara", "OK"], ["Oca", "OK"], ["Şub", "OK"], ["Mar", "OK"], ["Nis", "OK"], ["May", "YAK"]
                  ].map(([m, s], i) => {
                    const colors = { OK: T.success500, YAK: T.orange500 };
                    return (
                      <div key={i} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ aspectRatio: "1", background: colors[s], borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800 }}>{s === "OK" ? "✓" : "!"}</div>
                        <div style={{ fontSize: 9, color: T.muted, marginTop: 4, fontWeight: 700, textTransform: "uppercase" }}>{m}</div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Bağlı Görev</div>
                <div style={{ padding: 10, border: `1px solid ${T.border}`, borderRadius: 8, borderLeft: `3px solid ${T.orange500}`, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>SMMM faturasını al ve öde</div>
                  <div style={{ fontSize: 11, color: T.ink2, marginTop: 4 }}>Atanan: Melek · Son: 10.06.2026</div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Bağlı Fatura/Dekont</div>
                <div style={{ padding: 10, border: `1px dashed ${T.border}`, borderRadius: 8, textAlign: "center", color: T.ink2, fontSize: 11, marginBottom: 14 }}>
                  Henüz fatura bağlı değil.<br />
                  <span style={{ color: T.brand700, fontWeight: 600, cursor: "pointer" }}>+ Fatura Yükle</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Btn variant="primary" size="sm" style={{ justifyContent: "center" }}>✓ Ödendi İşaretle</Btn>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>📎 Fatura/Dekont Yükle</Btn>
                  <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>💬 Chat aç</Btn>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 14 — 14 ETA / Papinet / Entegratör / Kontör
   ============================================================ */
function EntegratorFrame() {
  const kpis = [
    { l: "Aktif Hizmet", v: "11", c: T.brand900 },
    { l: "30 Gün İçinde Bitecek", v: "2", c: T.orange500 },
    { l: "Kritik Kontör", v: "2", c: T.danger500 },
    { l: "Bu Yıl Ödenen", v: MoneyTR(245870.0), c: T.brand700, mono: true },
    { l: "Eksik Sözleşme", v: "1", c: T.warning500 },
    { l: "Kontrol Gerekli", v: "1", c: T.purple500 },
  ];
  const risks = [
    { l: "Kontör Kritik", d: "Acme Enerji · Papinet e-Fatura · 420 / 5.000", c: T.danger500 },
    { l: "Sözleşme Bitişi", d: "Beta Tekstil · EDM e-Arşiv · 15.02.2027 (T-285)", c: T.orange500 },
    { l: "ETA Versiyon Yenileme", d: "Acme Tekstil · 2026 yenileme · 01.03.2027", c: T.warning500 },
    { l: "Defter Saklama", d: "MDT · 2026 yıllık · 31.12.2026", c: T.info500 },
  ];

  const rows = [
    { sirket: "Acme Enerji", sag: "Papinet", hiz: "e-Fatura", paket: "5.000 Kontör Paketi", bas: "01.01.2026", bit: "31.12.2026", top: 5000, kal: 420, esk: 500, bedel: 38500, st: "KONTÖR KRİTİK", stBg: T.danger100, stFg: T.danger500, sel: true },
    { sirket: "Acme Tekstil", sag: "ETA", hiz: "Muhasebe Yazılımı", paket: "Versiyon Yenileme 2026", bas: "01.03.2026", bit: "01.03.2027", top: null, kal: null, esk: null, bedel: 24750, st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500 },
    { sirket: "Beta Tekstil", sag: "EDM", hiz: "e-Arşiv", paket: "Yıllık Sözleşme", bas: "15.02.2026", bit: "15.02.2027", top: 2500, kal: 1850, esk: 300, bedel: 18900, st: "AKTİF", stBg: T.success100, stFg: T.success500 },
    { sirket: "KC İplik", sag: "Digital Planet", hiz: "e-İrsaliye", paket: "Kontör Paketi", bas: "10.04.2026", bit: "—", top: 1000, kal: 120, esk: 100, bedel: 9250, st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500 },
    { sirket: "MDT", sag: "Papinet", hiz: "Defter Saklama", paket: "2026 Yıllık", bas: "01.01.2026", bit: "31.12.2026", top: null, kal: null, esk: null, bedel: 14400, st: "AKTİF", stBg: T.success100, stFg: T.success500 },
    { sirket: "MakYapı", sag: "EDM", hiz: "e-Fatura", paket: "Yıllık + 2.000 Kontör", bas: "01.06.2025", bit: "01.06.2026", top: 2000, kal: 1480, esk: 200, bedel: 21500, st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500 },
    { sirket: "FMK Turizm", sag: "Papinet", hiz: "e-Arşiv", paket: "1.000 Kontör", bas: "10.03.2026", bit: "—", top: 1000, kal: 800, esk: 150, bedel: 7800, st: "AKTİF", stBg: T.success100, stFg: T.success500 },
  ];

  const KontorBar = ({ kal, top, esk }) => {
    if (top === null) return <span style={{ fontSize: 11, color: T.muted }}>—</span>;
    const pct = (kal / top) * 100;
    const critical = kal < esk;
    return (
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: critical ? T.danger500 : T.brand900 }}>{kal.toLocaleString("tr-TR")}</span>
          <span style={{ color: T.muted, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>/ {top.toLocaleString("tr-TR")}</span>
        </div>
        <div style={{ height: 6, background: T.border, borderRadius: 9999, overflow: "hidden", position: "relative" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: critical ? T.danger500 : pct < 30 ? T.warning500 : T.success500 }} />
          <div style={{ position: "absolute", top: -2, height: 10, width: 1.5, background: T.brand900, left: `${(esk / top) * 100}%` }} title={`Eşik: ${esk}`} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="entegrator" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Şirket / Entegratör & Kontör</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Entegratör & Kontör Takibi</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>ETA, Papinet, EDM, Digital Planet, kontör paketleri, sözleşme ve yenileme takibi.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">⬆ Sözleşme Import</Btn>
              <Btn variant="secondary" size="md">⚡ Kontör Satın Al</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Hizmet</Btn>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 14 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.c, marginTop: 6, fontFamily: k.mono ? "'IBM Plex Mono', ui-monospace, monospace" : "inherit" }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* RİSK KARTLARI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
            {risks.map((r) => (
              <Card key={r.l} pad={14} style={{ borderLeft: `4px solid ${r.c}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: r.c }}>{r.l}</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 6, fontFamily: r.l === "Kontör Kritik" ? "'IBM Plex Mono', ui-monospace, monospace" : "inherit" }}>{r.d}</div>
              </Card>
            ))}
          </div>

          {/* FILTER */}
          <Card pad={14} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", flex: "1 1 240px", minWidth: 220, color: T.muted, fontSize: 13 }}>
                {Ico.search}<span>Şirket, hizmet, paket no...</span>
              </div>
              {["Şirket: Tümü ▾", "Sağlayıcı: Tümü ▾", "Hizmet: Tümü ▾", "Sözleşme: Tümü ▾", "Kontör: Tümü ▾", "Yıl: 2026 ▾"].map((c) => (
                <div key={c} style={{ height: 32, padding: "0 10px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 12, color: T.ink2 }}>{c}</div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 8, background: T.danger100, color: T.danger500, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 28, height: 16, background: T.danger500, borderRadius: 9999, position: "relative" }}>
                  <span style={{ position: "absolute", right: 2, top: 2, width: 12, height: 12, background: "#fff", borderRadius: 9999 }} />
                </span>
                Sadece Kritikler
              </div>
              <Btn variant="ghost" size="sm">Temizle</Btn>
            </div>
          </Card>

          {/* TABLO + DRAWER */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
            <Card pad={0}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 100px 1.4fr 90px 90px 140px 110px 130px 60px", gap: 6, padding: "10px 14px", background: "#FAFBFC", fontSize: 9, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
                <div>Şirket</div><div>Sağlayıcı</div><div>Hizmet</div><div>Paket / Sözleşme</div><div>Başlangıç</div><div>Bitiş</div><div>Kontör</div><div style={{ textAlign: "right" }}>Bedel</div><div>Durum</div><div></div>
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 100px 1.4fr 90px 90px 140px 110px 130px 60px", gap: 6, padding: "12px 14px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 11, background: r.sel ? T.brand100 : "#fff" }}>
                  <div style={{ fontWeight: 600, color: T.ink, fontSize: 12 }}>{r.sirket}</div>
                  <div>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800, background: T.purple100, color: T.purple500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{r.sag}</span>
                  </div>
                  <div style={{ color: T.ink2, fontSize: 11 }}>{r.hiz}</div>
                  <div style={{ color: T.ink, fontSize: 11 }}>{r.paket}</div>
                  <div style={{ fontSize: 10, color: T.ink2, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{r.bas}</div>
                  <div style={{ fontSize: 10, color: T.ink, fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: r.bit !== "—" ? 600 : 400 }}>{r.bit}</div>
                  <div><KontorBar kal={r.kal} top={r.top} esk={r.esk} /></div>
                  <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 700, color: T.brand900 }}>{MoneyTR(r.bedel)}</div>
                  <div><StatusTag label={r.st} bg={r.stBg} fg={r.stFg} pulse={r.st === "KONTÖR KRİTİK"} /></div>
                  <div style={{ display: "flex", gap: 3 }}>
                    <span title="Sözleşme PDF" style={{ fontSize: 14, color: T.danger500, cursor: "pointer" }}>📄</span>
                    <button style={{ width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 11 }}>⋯</button>
                  </div>
                </div>
              ))}
            </Card>

            {/* DRAWER */}
            <Card pad={0} style={{ height: "fit-content" }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.danger100 }}>
                <StatusTag label="KONTÖR KRİTİK" bg="#fff" fg={T.danger500} pulse />
                <div style={{ fontSize: 15, fontWeight: 700, color: T.brand900, marginTop: 8 }}>Papinet · e-Fatura</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>Acme Enerji · 5.000 Kontör Paketi</div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Kontör Kullanımı</span>
                    <span style={{ fontSize: 11, color: T.danger500, fontWeight: 700 }}>%92 kullanıldı</span>
                  </div>
                  <div style={{ height: 12, background: T.border, borderRadius: 9999, overflow: "hidden", position: "relative" }}>
                    <div style={{ height: "100%", width: "92%", background: T.danger500 }} />
                    <div style={{ position: "absolute", top: -3, height: 18, width: 2, background: T.brand900, left: "90%" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
                    <span style={{ color: T.danger500, fontWeight: 700 }}>Kalan: 420</span>
                    <span style={{ color: T.brand700, fontWeight: 600 }}>Eşik: 500</span>
                    <span style={{ color: T.muted }}>Toplam: 5.000</span>
                  </div>
                </div>

                <div style={{ padding: 10, background: T.danger100, borderRadius: 8, fontSize: 12, color: T.danger500, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  ⚠ Kontör eşik altında! Yeni paket önerilir.
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Sözleşme Timeline</div>
                <div style={{ position: "relative", height: 36, background: T.border, borderRadius: 9999, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, width: "37%", background: T.brand500 }} />
                  <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>01.01.2026</div>
                  <div style={{ position: "absolute", right: 8, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 10, color: T.ink, fontWeight: 700 }}>31.12.2026</div>
                  <div style={{ position: "absolute", left: "37%", top: -4, bottom: -4, width: 2, background: T.accent500 }} />
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Son Kontör Satın Alma</div>
                {[
                  ["5.000 paket", "01.01.2026", MoneyTR(38500)],
                  ["3.000 paket", "12.07.2025", MoneyTR(22750)],
                ].map(([p, d, m], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 1 ? `1px solid ${T.border}` : "none", fontSize: 11 }}>
                    <span style={{ color: T.ink, fontWeight: 600 }}>{p}</span>
                    <span style={{ color: T.ink2, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{d}</span>
                    <span style={{ color: T.brand900, fontWeight: 700, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{m}</span>
                  </div>
                ))}

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                  <Btn variant="primary" size="sm" style={{ justifyContent: "center" }}>⚡ Yeni Kontör Al</Btn>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>🔄 Sözleşme Yenile</Btn>
                  <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>+ Görev / 💬 Chat</Btn>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 15 — 15 Ajanda & Görev Yönetimi
   ============================================================ */
function AjandaFrame() {
  const kpis = [
    { l: "Bugünkü Görevler", v: "8", c: T.brand900 },
    { l: "Geciken", v: "3", c: T.danger500 },
    { l: "Tamamlanma", v: "%72", c: T.success500 },
    { l: "Bana Atananlar", v: "5", c: T.info500 },
    { l: "Benim Atadıklarım", v: "12", c: T.brand700 },
    { l: "Kritik", v: "1", c: T.danger500 },
  ];

  const tasks = [
    { t: "SiteX A4.17 Mayıs aidat ekstre kontrolü", b: "SiteX / A4.17 / 2026-05", at: "Müdür", an: "Ayşe", anC: T.success500, son: "20.05.2026", days: "+6 gün", st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, onc: T.warning500, y: 3, e: 1 },
    { t: "Albaraka 71-D8-3842 teminat komisyon dekontu yükle", b: "Teminat / 71-D8-3842", at: "Yönetici", an: "Erdal", anC: T.info500, son: "12.05.2026", days: "−2 gün", st: "GECİKTİ", stBg: T.danger100, stFg: T.danger500, onc: T.danger500, y: 2, e: 0, sel: true },
    { t: "Acme Enerji TT PDF faturasını import et", b: "Fatura / TT-2026-0419", at: "Ayşe", an: "Melek", anC: T.purple500, son: "Bugün", days: "0", st: "GÖREV AÇIK", stBg: T.info100, stFg: T.info500, onc: T.info500, y: 0, e: 0 },
    { t: "ETA Papinet sözleşme yenileme fiyatını kontrol et", b: "Entegratör / ETA Tekstil", at: "Yönetici", an: "Müdür", anC: T.brand500, son: "30.05.2026", days: "+16 gün", st: "KONTROL GEREKLİ", stBg: T.purple100, stFg: T.purple500, onc: T.purple500, y: 5, e: 2 },
    { t: "BAĞKUR Mayıs ödeme dekontlarını kontrol et", b: "Resmi / BAĞKUR / 2026-05", at: "Müdür", an: "Ayşe", anC: T.success500, son: "31.05.2026", days: "+17 gün", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, onc: T.warning500, y: 1, e: 0 },
    { t: "SiteX B3.31 aidat farkı mutabakat", b: "SiteX / B3.31 / 2026-04", at: "Müdür", an: "Erdal", anC: T.info500, son: "25.05.2026", days: "+11 gün", st: "GÖREV AÇIK", stBg: T.info100, stFg: T.info500, onc: T.info500, y: 4, e: 1 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="ajanda" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Operasyon / Ajanda & Görev</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Ajanda & Görev Yönetimi</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Kullanıcı bazlı günlük işler, atamalar, geciken görevler ve kayıt bağlantılı görev takibi.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">📅 Takvim</Btn>
              <Btn variant="secondary" size="md">🗂 Kanban</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Görev</Btn>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 14 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.c, marginTop: 6 }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* TABS */}
          <Card pad={0} style={{ marginBottom: 14 }}>
            <div style={{ padding: "0 16px", display: "flex", gap: 4, borderBottom: `1px solid ${T.border}` }}>
              {[
                ["Bugün", true, 8],
                ["Yaklaşan", false, 14],
                ["Geciken", false, 3],
                ["Bana Atananlar", false, 5],
                ["Benim Atadıklarım", false, 12],
                ["Kanban", false, null],
                ["Takvim", false, null],
              ].map(([l, a, c]) => (
                <div key={l} style={{ padding: "12px 14px", fontSize: 13, fontWeight: a ? 700 : 500, color: a ? T.brand900 : T.ink2, borderBottom: a ? `2px solid ${T.brand700}` : "2px solid transparent", marginBottom: -1, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {l}
                  {c !== null && <span style={{ padding: "1px 6px", background: a ? T.brand700 : T.border, color: a ? "#fff" : T.ink2, borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>{c}</span>}
                </div>
              ))}
            </div>
          </Card>

          {/* GÖREV LİSTESİ + DETAY DRAWER */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tasks.map((t, i) => (
                <Card key={i} pad={14} style={{ borderLeft: `4px solid ${t.onc}`, background: t.sel ? T.brand100 : T.card, boxShadow: t.sel ? "0 6px 16px rgba(15,37,64,0.10)" : undefined }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <input type="checkbox" style={{ width: 20, height: 20, marginTop: 2, accentColor: T.brand700 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <StatusTag label={t.st} bg={t.stBg} fg={t.stFg} pulse={t.st === "GECİKTİ"} />
                        <span style={{ fontSize: 11, color: t.days.includes("−") ? T.danger500 : T.ink2, fontWeight: 700 }}>{t.son} · {t.days}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{t.t}</div>
                      <div style={{ fontSize: 11, color: T.brand700, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>📎 {t.b}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, minWidth: 140 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 24, height: 24, borderRadius: 9999, background: T.brand500, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, border: "2px solid #fff" }}>{t.at[0]}</span>
                        <span style={{ fontSize: 18, color: T.muted }}>→</span>
                        <span style={{ width: 28, height: 28, borderRadius: 9999, background: t.anC, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{t.an[0]}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, fontSize: 11, color: T.muted }}>
                        <span>💬 {t.y}</span>
                        <span>📎 {t.e}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{ padding: "4px 10px", border: `1px solid ${T.success500}`, color: T.success500, borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✓ Tamamla</button>
                        <button style={{ width: 28, height: 24, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 12 }}>⏰</button>
                        <button style={{ width: 28, height: 24, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 12 }}>💬</button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* GÖREV DETAY DRAWER */}
            <Card pad={0} style={{ height: "fit-content" }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.danger100 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <StatusTag label="GECİKTİ" bg="#fff" fg={T.danger500} pulse />
                  <span style={{ fontSize: 14, color: T.muted, cursor: "pointer" }}>✕</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginTop: 8, lineHeight: 1.4 }}>Albaraka 71-D8-3842 teminat komisyon dekontu yükle</div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ padding: 10, background: T.brand100, borderRadius: 8, marginBottom: 12, fontSize: 11 }}>
                  <div style={{ color: T.brand500, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>📎 Bağlı Kayıt</div>
                  <div style={{ color: T.brand700, fontWeight: 700 }}>Teminat / 71-D8-3842</div>
                  <div style={{ color: T.ink2, marginTop: 2 }}>Albaraka · TEİAŞ · ₺ 2.000.000,00</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Atayan</div>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, marginTop: 2 }}>👤 Yönetici</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Atanan</div>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, marginTop: 2 }}>👤 Erdal</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Öncelik</div>
                    <div style={{ fontSize: 12, color: T.danger500, fontWeight: 700, marginTop: 2 }}>🔴 Acil</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Son Tarih</div>
                    <div style={{ fontSize: 12, color: T.danger500, fontWeight: 700, marginTop: 2 }}>12.05.2026 (−2)</div>
                  </div>
                </div>

                {/* TABS */}
                <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
                  {[["Genel", false], ["Yorumlar", true, 2], ["Dosyalar", false, 0], ["Geçmiş", false]].map(([l, a, c]) => (
                    <div key={l} style={{ padding: "8px 10px", fontSize: 11, fontWeight: a ? 700 : 500, color: a ? T.brand700 : T.ink2, borderBottom: a ? `2px solid ${T.brand700}` : "none", marginBottom: -1, cursor: "pointer" }}>{l}{c !== undefined && c !== null && <span style={{ marginLeft: 4, color: T.muted }}>({c})</span>}</div>
                  ))}
                </div>

                {/* YORUM THREAD */}
                <div style={{ padding: 10, background: T.bg, borderRadius: 8, marginBottom: 8, fontSize: 11 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 9999, background: T.brand500, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>Y</span>
                    <span style={{ fontWeight: 700, color: T.brand900 }}>Yönetici</span>
                    <span style={{ color: T.muted, marginLeft: "auto" }}>11.05 14:32</span>
                  </div>
                  <div style={{ color: T.ink }}>Komisyon ödendi, dekontu da bugün yüklemen lazım.</div>
                </div>
                <div style={{ padding: 10, background: T.bg, borderRadius: 8, marginBottom: 12, fontSize: 11 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 9999, background: T.info500, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>E</span>
                    <span style={{ fontWeight: 700, color: T.brand900 }}>Erdal</span>
                    <span style={{ color: T.muted, marginLeft: "auto" }}>12.05 09:00</span>
                  </div>
                  <div style={{ color: T.ink }}>Albaraka şubesinden dekont alıyorum, akşama yüklerim.</div>
                </div>
                <div style={{ height: 60, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, fontSize: 12, color: T.muted, marginBottom: 12 }}>Yorum yazın... @Erdal</div>

                {/* ERTELE MİNİ */}
                <div style={{ padding: 10, background: T.warning100, borderRadius: 8, marginBottom: 12, fontSize: 11, border: `1px dashed ${T.warning500}` }}>
                  <div style={{ fontWeight: 700, color: T.warning500, marginBottom: 4 }}>⏰ Erteleme (örnek)</div>
                  <div style={{ color: T.ink2 }}>Yeni tarih + sebep zorunlu · audit'lenir.</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Btn variant="success" size="sm" style={{ justifyContent: "center" }}>✓ Tamamla</Btn>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>📎 Dosya Yükle</Btn>
                  <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>💬 Görevden Chat Aç</Btn>
                </div>
              </div>
            </Card>
          </div>

          {/* KANBAN MINI PREVIEW */}
          <Card pad={14}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900 }}>Kanban (Önizleme)</div>
              <Btn variant="ghost" size="sm">Tam ekran →</Btn>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
              {[
                { l: "Yeni", c: T.muted, n: 4, items: ["TT fatura import", "B3.31 aidat farkı"] },
                { l: "Başladı", c: T.info500, n: 6, items: ["Dekont yükle", "ETA fiyat kontrol"] },
                { l: "Bekliyor", c: T.warning500, n: 3, items: ["BAĞKUR dekont"] },
                { l: "Ertelendi", c: T.purple500, n: 2, items: ["Site denetim raporu"] },
                { l: "Tamamlandı", c: T.success500, n: 18, items: ["Albaraka talimat", "CK Boğaziçi ödendi", "+16"] },
              ].map((col) => (
                <div key={col.l} style={{ background: T.bg, borderRadius: 10, padding: 10, borderTop: `3px solid ${col.c}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: col.c, textTransform: "uppercase", letterSpacing: "0.06em" }}>{col.l}</span>
                    <span style={{ fontSize: 11, color: T.muted, fontWeight: 700 }}>{col.n}</span>
                  </div>
                  {col.items.map((it, i) => (
                    <div key={i} style={{ padding: 8, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, marginBottom: 6, fontSize: 11, color: T.ink, fontWeight: 500 }}>{it}</div>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <div style={{ marginTop: 12, padding: 10, background: T.brand100, borderRadius: 8, fontSize: 11, color: T.brand700, fontWeight: 600 }}>
            📱 Mobile: kart akışı + swipe right (tamamla) / left (ertele) + FAB (+) — bu sprintte ayrı frame yok.
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 16 — 16 Bildirim / Telegram Merkezi
   ============================================================ */
function BildirimFrame() {
  const kpis = [
    { l: "Bugünkü Bildirim", v: "42", c: T.brand900 },
    { l: "Bekleyen Dry-run", v: "8", c: T.warning500 },
    { l: "Test Başarılı", v: "24", c: T.success500 },
    { l: "Gerçek Gönderim", v: "KAPALI", c: T.danger500, small: true },
    { l: "Hatalı", v: "1", c: T.danger500 },
    { l: "Susturulan", v: "3", c: T.muted },
  ];
  const kategoriler = [
    ["Fatura son ödeme", 18, T.warning500, true],
    ["SiteX ayın 20'si", 5, T.brand700, false],
    ["Emlak vergisi taksit", 2, T.orange500, false],
    ["Teminat komisyon", 4, T.info500, false],
    ["BAĞKUR / SSK / BES / İTO", 9, T.success500, false],
    ["Entegratör sözleşme", 2, T.purple500, false],
    ["Kontör kritik", 2, T.danger500, false],
    ["Eksik dekont/fatura", 7, T.orange500, false],
    ["Geciken görevler", 3, T.danger500, false],
    ["Import kontrol bekleyen", 1, T.info500, false],
  ];
  const rows = [
    { z: "05.05 09:00", mod: "SiteX", kur: "T-15 Aidat", hed: "Dashboard", kan: "SISTEM", st: "CREATED", stBg: T.info100, stFg: T.info500, alc: "Ayşe", msg: "SiteX A4.17 — 20.05 ödeme yaklaşıyor", den: 1 },
    { z: "05.05 09:02", mod: "Teminat", kur: "Komisyon T-7", hed: "Telegram", kan: "DRY-RUN", st: "SUCCESS", stBg: T.success100, stFg: T.success500, alc: "Müdür", msg: "Albaraka 71-D8-3842 komisyon T-7", den: 1, sel: true },
    { z: "05.05 09:05", mod: "Kontör", kur: "Kritik Eşik", hed: "Telegram", kan: "TEST", st: "SUCCESS", stBg: T.success100, stFg: T.success500, alc: "Yönetici", msg: "Papinet e-Fatura kontörü 420/5000 (eşik altı)", den: 1 },
    { z: "05.05 09:10", mod: "Emlak", kur: "1. Taksit T-15", hed: "Dashboard", kan: "SISTEM", st: "PENDING", stBg: T.warning100, stFg: T.warning500, alc: "Ayşe", msg: "Bayrampaşa Mega Center — 1.taksit 31.05", den: 0 },
    { z: "05.05 09:15", mod: "Fatura", kur: "Geciken", hed: "Telegram", kan: "DRY-RUN", st: "FAILED", stBg: T.danger100, stFg: T.danger500, alc: "Erdal", msg: "Beta Tekstil SMMM gecikti", den: 3 },
    { z: "05.05 09:18", mod: "BAĞKUR", kur: "T-3 Ödeme", hed: "Dashboard", kan: "SISTEM", st: "CREATED", stBg: T.info100, stFg: T.info500, alc: "Müdür", msg: "BAĞKUR Mayıs · 5 kişi · 31.05", den: 1 },
    { z: "05.05 09:25", mod: "Görev", kur: "Geciken Özet", hed: "Telegram", kan: "DRY-RUN", st: "PENDING", stBg: T.warning100, stFg: T.warning500, alc: "Müdür", msg: "3 geciken görev (Erdal: 1, Ayşe: 2)", den: 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="bildirim" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sistem / Bildirim & Telegram</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Bildirim & Telegram Merkezi</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Sistem içi uyarılar, NotificationLog ve Telegram gönderim kapıları.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">▶ Test Telegram</Btn>
              <Btn variant="secondary" size="md">▶ Dry-run Çalıştır</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Kural</Btn>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: k.small ? 14 : 22, fontWeight: 800, color: k.c, marginTop: 6 }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* 4 AŞAMALI BİLDİRİM KAPISI */}
          <Card pad={20} style={{ marginBottom: 16, borderTop: `4px solid ${T.brand700}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900 }}>🛡 4 Aşamalı Bildirim Kapısı</div>
                <div style={{ fontSize: 11, color: T.ink2, marginTop: 2 }}>Anayasa Madde 8 · Telegram gerçek gönderimi son aşamadır</div>
              </div>
              <div style={{ padding: "8px 14px", background: T.danger500, color: "#fff", borderRadius: 9999, fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                🔒 Gerçek Telegram: KAPALI
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr 24px 1fr 24px 1fr", gap: 0, alignItems: "center" }}>
              {[
                { n: "1", l: "Dashboard Uyarısı", d: "Anında · sistem içi", c: T.success500, status: "AKTİF" },
                { n: "2", l: "NotificationLog + Dry-run", d: "Admin görür, gönderilmez", c: T.success500, status: "AKTİF" },
                { n: "3", l: "Test Telegram", d: "Sınırlı test kanalı", c: T.warning500, status: "AKTİF" },
                { n: "4", l: "Gerçek Telegram", d: "Tüm kullanıcılar / gruplar", c: T.danger500, status: "KAPALI" },
              ].map((s, i) => (
                <React.Fragment key={s.n}>
                  <div style={{ padding: 14, background: s.status === "KAPALI" ? T.danger100 : T.success100, borderRadius: 10, border: `2px solid ${s.c}`, textAlign: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9999, background: s.c, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{s.n}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.brand900 }}>{s.l}</div>
                    <div style={{ fontSize: 10, color: T.ink2, marginTop: 2 }}>{s.d}</div>
                    <div style={{ marginTop: 8 }}><StatusTag label={s.status} bg="#fff" fg={s.c} pulse={s.status === "KAPALI"} /></div>
                  </div>
                  {i < 3 && <div style={{ textAlign: "center", color: T.muted, fontSize: 18 }}>→</div>}
                </React.Fragment>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: 10, background: T.warning100, borderRadius: 8, fontSize: 12, color: T.warning500, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              ⚠ Gerçek Telegram açmak için <b>Super Admin</b> onayı gerekir. Faz 12'de açılacaktır.
            </div>
          </Card>

          {/* SOL PANEL KATEGORİLER + ANA TABLO + DRAWER */}
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 320px", gap: 16 }}>
            {/* SOL: KATEGORİLER */}
            <Card pad={14} style={{ height: "fit-content" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>Bildirim Kategorileri</div>
              {kategoriler.map(([l, n, c, sel]) => (
                <div key={l} style={{ padding: "8px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 8, marginBottom: 2, background: sel ? T.brand100 : "transparent", cursor: "pointer" }}>
                  <div style={{ width: 6, height: 6, borderRadius: 9999, background: c }} />
                  <div style={{ fontSize: 11, color: sel ? T.brand700 : T.ink, flex: 1, fontWeight: sel ? 600 : 500 }}>{l}</div>
                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{n}</div>
                </div>
              ))}
            </Card>

            {/* ORTA: NOTIFICATIONLOG */}
            <Card pad={0}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.brand900, display: "flex", justifyContent: "space-between" }}>
                <span>NotificationLog</span>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>42 kayıt · son 24 saat</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "100px 90px 100px 90px 90px 110px 80px 50px", gap: 6, padding: "10px 14px", background: "#FAFBFC", fontSize: 9, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
                <div>Zaman</div><div>Modül</div><div>Kural</div><div>Hedef</div><div>Kanal</div><div>Durum</div><div>Alıcı</div><div></div>
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, background: r.sel ? T.brand100 : "#fff" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 90px 100px 90px 90px 110px 80px 50px", gap: 6, alignItems: "center", fontSize: 11 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: T.ink2, fontSize: 10 }}>{r.z}</div>
                    <div><span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: T.brand100, color: T.brand700 }}>{r.mod}</span></div>
                    <div style={{ color: T.ink, fontWeight: 600 }}>{r.kur}</div>
                    <div style={{ color: T.ink2 }}>{r.hed}</div>
                    <div>
                      <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800, background: r.kan === "DRY-RUN" ? T.warning100 : r.kan === "TEST" ? T.info100 : T.success100, color: r.kan === "DRY-RUN" ? T.warning500 : r.kan === "TEST" ? T.info500 : T.success500 }}>{r.kan}</span>
                    </div>
                    <div><StatusTag label={r.st} bg={r.stBg} fg={r.stFg} pulse={r.st === "FAILED"} /></div>
                    <div style={{ color: T.ink, fontSize: 11 }}>{r.alc}</div>
                    <div>{r.den > 1 ? <span style={{ fontSize: 10, color: T.danger500, fontWeight: 700 }}>×{r.den}</span> : null}</div>
                  </div>
                  <div style={{ marginTop: 4, marginLeft: 0, fontSize: 10, color: T.muted, paddingLeft: 0 }}>💬 {r.msg}</div>
                </div>
              ))}
            </Card>

            {/* SAĞ: DRAWER */}
            <Card pad={0} style={{ height: "fit-content" }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.success100 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <StatusTag label="SUCCESS" bg="#fff" fg={T.success500} />
                  <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800, background: T.warning100, color: T.warning500 }}>DRY-RUN</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900 }}>Teminat · Komisyon T-7</div>
                <div style={{ fontSize: 11, color: T.ink2, marginTop: 2 }}>05.05.2026 09:02:14</div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Mesaj Önizleme</div>
                <div style={{ padding: 10, background: T.bg, borderRadius: 8, fontSize: 12, color: T.ink, lineHeight: 1.5, marginBottom: 14, border: `1px solid ${T.border}` }}>
                  📋 <b>Teminat Komisyon T-7</b><br />
                  <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11 }}>Albaraka · 71-D8-3842<br />TEİAŞ · Kısık HES<br />Tutar: ₺ 16.000,00<br />Son: 12.05.2026</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Kanal</div>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, marginTop: 2 }}>📤 Telegram (Dry-run)</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Hedef</div>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, marginTop: 2 }}>👤 Müdür</div>
                  </div>
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Deneme Geçmişi</div>
                <div style={{ padding: 8, background: T.bg, borderRadius: 6, fontSize: 11, color: T.ink2, marginBottom: 14 }}>
                  <div>1. deneme · 09:02:14 · ✓ SUCCESS</div>
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>İlgili Kayıt</div>
                <div style={{ padding: 8, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11, marginBottom: 14, cursor: "pointer", background: T.brand100 }}>
                  <div style={{ color: T.brand700, fontWeight: 700 }}>📎 Teminat / 71-D8-3842</div>
                  <div style={{ color: T.ink2, marginTop: 2 }}>Albaraka · ₺ 2.000.000,00</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Btn variant="primary" size="sm" style={{ justifyContent: "center" }}>🔄 Yeniden Dene</Btn>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>+ Görev Oluştur</Btn>
                  <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>🔇 Sustur</Btn>
                </div>
              </div>
            </Card>
          </div>

          {/* ALT BÖLÜM: ZAMAN MİNİ TIMELINE + KANAL DURUMU */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
            <Card pad={16}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 14 }}>Bildirim Kural Zamanları</div>
              <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative" }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: T.border, transform: "translateY(-50%)" }} />
                {[
                  ["T-30", "Sözleşme Bitişi", T.muted],
                  ["T-15", "Emlak / İTO", T.warning500],
                  ["T-7", "Komisyon / Taahhüt", T.orange500],
                  ["T-3", "SiteX / SSK", T.warning500],
                  ["T-1", "Fatura Son Ödeme", T.danger500],
                  ["T-0", "Son Gün", T.danger500],
                ].map(([t, l, c], i) => (
                  <div key={t} style={{ flex: 1, position: "relative", textAlign: "center", zIndex: 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9999, background: c, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, border: "3px solid #fff" }}>{t}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink, marginTop: 6 }}>{l}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card pad={16}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 12 }}>Telegram Kanal Durumu</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["Muhasebe Grubu", "DRY-RUN", T.warning500, T.warning100, "5 üye"],
                  ["Yönetici Grubu", "DRY-RUN", T.warning500, T.warning100, "2 üye"],
                  ["Test Kanalı", "TEST AKTİF", T.success500, T.success100, "1 admin"],
                  ["Gerçek Gönderim Kapısı", "🔒 KAPALI", T.danger500, T.danger100, "Super Admin onayı bekliyor"],
                ].map(([n, s, c, b, d]) => (
                  <div key={n} style={{ padding: 10, background: b, borderRadius: 8, borderLeft: `3px solid ${c}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.brand900 }}>{n}</div>
                      <span style={{ fontSize: 9, fontWeight: 800, color: c, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.ink2, marginTop: 4 }}>{d}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 17 — 17 Raporlama / Excel Export Merkezi
   ============================================================ */
function RaporlamaFrame() {
  const MONO = "'IBM Plex Mono', ui-monospace, monospace";
  const kpis = [
    { l: "Hazır Şablon", v: "24", c: T.brand900 },
    { l: "Bu Ay Export", v: "186", c: T.brand700 },
    { l: "Planlı Rapor", v: "8", c: T.info500 },
    { l: "Bekleyen", v: "2", c: T.warning500 },
    { l: "Hatalı Export", v: "1", c: T.danger500 },
    { l: "Son Başarılı", v: "09:42", c: T.success500, mono: true },
  ];
  const kategoriler = [
    ["Genel Ödemeler", 4, false],
    ["Fatura & Ödeme", 5, true],
    ["Abonelik & Taahhüt", 2, false],
    ["SiteX", 3, false],
    ["Emlak Vergisi", 2, false],
    ["Teminat Mektupları", 2, false],
    ["Resmi Ödemeler", 2, false],
    ["Entegratör & Kontör", 2, false],
    ["Görevler", 1, false],
    ["AuditLog", 1, false],
  ];
  const sablonlar = [
    { ad: "Aylık Ödeme Durum Raporu", k: "Tüm modüller · 2026-05", son: "Bugün 09:42", fmt: ["XLSX", "PDF"], yetki: "Müdür+", sel: true },
    { ad: "Geciken Ödemeler Raporu", k: "Tüm modüller · son 30 gün", son: "Dün 17:30", fmt: ["XLSX"], yetki: "Yönetici" },
    { ad: "Eksik Dekont Raporu", k: "Fatura/Ödeme · 5K+ TL", son: "12.05 14:00", fmt: ["XLSX"], yetki: "Müdür+" },
    { ad: "SiteX Daire Bazlı Aidat", k: "5 daire · yıllık", son: "10.05 11:24", fmt: ["XLSX", "PDF"], yetki: "Müdür+" },
    { ad: "Emlak Vergisi Yıl/Taksit", k: "Tüm mülkler · 2024-26", son: "08.05 10:15", fmt: ["XLSX", "PDF"], yetki: "Yönetici" },
    { ad: "Teminat Komisyon Raporu", k: "Aktif mektuplar · banka bazlı", son: "07.05 16:45", fmt: ["XLSX", "PDF"], yetki: "Yönetici" },
    { ad: "BAĞKUR / SSK / BES / İTO", k: "Resmi · şahıs+şirket", son: "06.05 09:00", fmt: ["XLSX"], yetki: "Müdür+" },
    { ad: "Entegratör Kontör Kritik", k: "Eşik altı + sözleşme", son: "05.05 13:20", fmt: ["XLSX", "CSV"], yetki: "Yönetici" },
    { ad: "Kullanıcı Görev Performans", k: "Kişi bazlı · son 90 gün", son: "01.05 18:00", fmt: ["XLSX", "PDF"], yetki: "Yönetici" },
  ];
  const exportLog = [
    { z: "05.05 09:42", r: "Aylık Ödeme Durum", k: "Ayşe", f: "XLSX", n: 186, st: "BAŞARILI", stBg: T.success100, stFg: T.success500 },
    { z: "05.05 09:15", r: "Eksik Dekont", k: "Müdür", f: "XLSX", n: 9, st: "BAŞARILI", stBg: T.success100, stFg: T.success500 },
    { z: "05.05 08:30", r: "SiteX Aidat", k: "Müdür", f: "PDF", n: 60, st: "BAŞARILI", stBg: T.success100, stFg: T.success500 },
    { z: "04.05 17:45", r: "Teminat Komisyon", k: "Yönetici", f: "XLSX", n: 14, st: "BAŞARILI", stBg: T.success100, stFg: T.success500 },
    { z: "04.05 14:20", r: "BAĞKUR / SSK", k: "Erdal", f: "XLSX", n: 0, st: "HATA", stBg: T.danger100, stFg: T.danger500 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="rapor" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sistem / Raporlama</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Raporlama & Excel Export</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Modül bazlı raporlar, dönem karşılaştırmaları, Excel export ve planlı raporlar.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📅 Planlı Rapor</Btn>
              <Btn variant="secondary" size="md">📄 PDF Al</Btn>
              <Btn variant="secondary" size="md">📊 Excel Export</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Şablon</Btn>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.c, marginTop: 6, fontFamily: k.mono ? MONO : "inherit" }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* SOL KATEGORİ + ORTA ŞABLONLAR + SAĞ PREVIEW */}
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 360px", gap: 16, marginBottom: 16 }}>
            {/* SOL */}
            <Card pad={14} style={{ height: "fit-content" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.brand900, marginBottom: 10 }}>Rapor Kategorileri</div>
              {kategoriler.map(([l, n, sel]) => (
                <div key={l} style={{ padding: "8px 10px", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2, background: sel ? T.brand100 : "transparent", cursor: "pointer", borderLeft: sel ? `2px solid ${T.brand700}` : "2px solid transparent" }}>
                  <span style={{ fontSize: 12, color: sel ? T.brand700 : T.ink, fontWeight: sel ? 600 : 500 }}>{l}</span>
                  <span style={{ fontSize: 10, color: T.muted, fontFamily: MONO, fontWeight: 700 }}>{n}</span>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.ink2, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>Hızlı Filtreler</div>
                <div style={{ padding: "4px 0", cursor: "pointer" }}>📌 Favoriler</div>
                <div style={{ padding: "4px 0", cursor: "pointer" }}>🕒 Son kullanılan</div>
                <div style={{ padding: "4px 0", cursor: "pointer" }}>📅 Planlı raporlarım</div>
              </div>
            </Card>

            {/* ORTA — ŞABLON KARTLARI */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignContent: "start" }}>
              {sablonlar.map((s, i) => (
                <Card key={i} pad={14} style={{ borderLeft: s.sel ? `3px solid ${T.brand700}` : "3px solid transparent", boxShadow: s.sel ? "0 6px 16px rgba(15,37,64,0.10)" : undefined, background: s.sel ? T.brand100 : T.card, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, lineHeight: 1.4 }}>{s.ad}</div>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: T.brand100, color: T.brand700, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{s.yetki}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.ink2, marginTop: 6 }}>{s.k}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontFamily: MONO }}>Son: {s.son}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
                    {s.fmt.map((f) => (
                      <span key={f} style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800, background: f === "PDF" ? T.danger100 : f === "XLSX" ? T.success100 : T.info100, color: f === "PDF" ? T.danger500 : f === "XLSX" ? T.success500 : T.info500 }}>{f}</span>
                    ))}
                    <div style={{ flex: 1 }} />
                    <button style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", fontSize: 11, fontWeight: 600, color: T.ink2, cursor: "pointer" }}>Önizle</button>
                    <button style={{ padding: "4px 10px", border: `1px solid ${T.brand700}`, borderRadius: 4, background: T.brand700, fontSize: 11, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Export</button>
                  </div>
                </Card>
              ))}
            </div>

            {/* SAĞ — PREVIEW PANEL */}
            <Card pad={0} style={{ height: "fit-content" }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.brand100 }}>
                <div style={{ fontSize: 11, color: T.brand500, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Seçili Şablon</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginTop: 2 }}>Aylık Ödeme Durum Raporu</div>
              </div>
              <div style={{ padding: 16 }}>
                <FieldLabel>Tarih Aralığı</FieldLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <Input value="01.05.2026" />
                  <Input value="31.05.2026" />
                </div>
                <FieldLabel>Sahip Tipi</FieldLabel>
                <Input value="Tümü (Şirket + Şahıs)" />
                <div style={{ height: 8 }} />
                <FieldLabel>Şirket / Şahıs</FieldLabel>
                <Input placeholder="Tümü ▾" />
                <div style={{ height: 8 }} />
                <FieldLabel>Modül</FieldLabel>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {["Fatura", "Ödeme", "SiteX", "Emlak"].map((m, i) => (
                    <span key={m} style={{ padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: i < 2 ? T.brand700 : "#fff", color: i < 2 ? "#fff" : T.ink2, border: i < 2 ? "none" : `1px solid ${T.border}`, cursor: "pointer" }}>{m}{i < 2 ? " ✓" : ""}</span>
                  ))}
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                  <FieldLabel>Kolon Seçimi</FieldLabel>
                  {[
                    ["Sahip", true],
                    ["Kurum / Açıklama", true],
                    ["Dönem", true],
                    ["Son Ödeme", true],
                    ["Tutar", true],
                    ["Yöntem", true],
                    ["Durum", true],
                    ["Dekont (link)", false],
                    ["Görev sayısı", false],
                  ].map(([l, on]) => (
                    <label key={l} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: T.ink, cursor: "pointer" }}>
                      <span style={{ width: 16, height: 16, background: on ? T.brand700 : "#fff", border: `1.5px solid ${on ? T.brand700 : T.border}`, borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800 }}>{on ? "✓" : ""}</span>
                      {l}
                    </label>
                  ))}
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                  <FieldLabel>Format</FieldLabel>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["XLSX", true], ["PDF", false], ["CSV", false]].map(([f, sel]) => (
                      <span key={f} style={{ flex: 1, textAlign: "center", padding: "8px 4px", border: `1.5px solid ${sel ? T.brand700 : T.border}`, borderRadius: 6, background: sel ? T.brand100 : "#fff", color: sel ? T.brand700 : T.ink2, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{f}</span>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>👁 Önizle</Btn>
                  <Btn variant="primary" size="sm" style={{ justifyContent: "center" }}>📊 Export Al</Btn>
                  <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>📅 Planla</Btn>
                </div>
              </div>
            </Card>
          </div>

          {/* ALT — EXPORT GEÇMİŞİ */}
          <Card pad={0}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900 }}>Son Export Geçmişi</div>
              <span style={{ fontSize: 11, color: T.muted }}>186 export · son 30 gün</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1.5fr 110px 80px 90px 130px 110px 90px", gap: 10, padding: "10px 20px", background: "#FAFBFC", fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
              <div>Zaman</div><div>Rapor</div><div>Kullanıcı</div><div>Format</div><div style={{ textAlign: "right" }}>Satır</div><div>Durum</div><div>Dosya</div><div>Aksiyon</div>
            </div>
            {exportLog.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1.5fr 110px 80px 90px 130px 110px 90px", gap: 10, padding: "12px 20px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 12 }}>
                <div style={{ fontFamily: MONO, color: T.ink2, fontSize: 11 }}>{r.z}</div>
                <div style={{ color: T.ink, fontWeight: 600 }}>{r.r}</div>
                <div style={{ color: T.ink2 }}>{r.k}</div>
                <div><span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800, background: r.f === "PDF" ? T.danger100 : T.success100, color: r.f === "PDF" ? T.danger500 : T.success500 }}>{r.f}</span></div>
                <div style={{ textAlign: "right", fontFamily: MONO, color: r.n === 0 ? T.muted : T.brand900, fontWeight: 600 }}>{r.n.toLocaleString("tr-TR")}</div>
                <div><StatusTag label={r.st} bg={r.stBg} fg={r.stFg} pulse={r.st === "HATA"} /></div>
                <div>{r.st === "BAŞARILI" ? <button style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", fontSize: 11, color: T.brand700, fontWeight: 600, cursor: "pointer" }}>📥 İndir</button> : <span style={{ color: T.muted, fontSize: 11 }}>—</span>}</div>
                <div><button style={{ width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 11 }}>⋯</button></div>
              </div>
            ))}
          </Card>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 18 — 18 AuditLog & İşlem Geçmişi
   ============================================================ */
function AuditLogFrame() {
  const MONO = "'IBM Plex Mono', ui-monospace, monospace";
  const kpis = [
    { l: "Bugünkü İşlem", v: "248", c: T.brand900 },
    { l: "Kritik İşlem", v: "3", c: T.danger500 },
    { l: "Import Onayı", v: "5", c: T.info500 },
    { l: "Ödeme İşaretleme", v: "32", c: T.success500 },
    { l: "Hatalı", v: "2", c: T.danger500 },
    { l: "Super Admin", v: "1", c: T.brand700 },
  ];
  const rows = [
    { z: "05.05 14:32", k: "Ayşe", r: "Muhasebeci", m: "Fatura", kayit: "TT-2026-0419", is: "Ödeme İşaretledi", oz: "TR Telekom Mayıs · ₺12.430,50", st: "SUCCESS", stBg: T.success100, stFg: T.success500, ip: "192.168.1.42" },
    { z: "05.05 14:18", k: "Erdal", r: "Muhasebeci", m: "Teminat", kayit: "71-D8-3842", is: "Dekont Yükledi", oz: "Albaraka komisyon dekont · 312KB", st: "SUCCESS", stBg: T.success100, stFg: T.success500, ip: "192.168.1.51" },
    { z: "05.05 13:45", k: "Müdür", r: "Muhasebe Müd.", m: "Import", kayit: "SITEX_2026-04.rar", is: "46 Satır Onayladı", oz: "SiteX Mayıs ekstreleri · 5 daire", st: "SUCCESS", stBg: T.success100, stFg: T.success500, ip: "192.168.1.10", sel: true },
    { z: "05.05 13:20", k: "Super Admin", r: "Super Admin", m: "Yetki", kayit: "User: Ayşe", is: "Rol Güncelledi", oz: "Muhasebeci → Muhasebeci+Export", st: "CRITICAL", stBg: T.danger100, stFg: T.danger500, ip: "10.0.0.1" },
    { z: "05.05 12:55", k: "Melek", r: "Muhasebeci", m: "Emlak", kayit: "Bayrampaşa M.C.", is: "Makbuz Yükleme", oz: "PDF parse hatası · format desteklenmiyor", st: "FAILED", stBg: T.danger100, stFg: T.danger500, ip: "192.168.1.62" },
    { z: "05.05 12:00", k: "Sistem", r: "—", m: "NotificationLog", kayit: "Teminat T-7", is: "Dry-run Oluşturdu", oz: "Albaraka 71-D8-3842 · Müdür hedefli", st: "CREATED", stBg: T.info100, stFg: T.info500, ip: "—" },
    { z: "05.05 11:42", k: "Ayşe", r: "Muhasebeci", m: "SiteX", kayit: "A4.17 / 2026-04", is: "Ekstre PDF Görüntüledi", oz: "PDF açıldı · 12 sn süre", st: "SUCCESS", stBg: T.success100, stFg: T.success500, ip: "192.168.1.42" },
    { z: "05.05 10:30", k: "Müdür", r: "Muhasebe Müd.", m: "Görev", kayit: "SiteX mutabakat", is: "Görev Atadı", oz: "Atanan: Erdal · Son: 25.05.2026", st: "SUCCESS", stBg: T.success100, stFg: T.success500, ip: "192.168.1.10" },
    { z: "05.05 09:15", k: "Yönetici", r: "Yönetici", m: "Rapor", kayit: "Aylık Ödeme Durum", is: "Excel Export", oz: "186 satır · 4.2 MB", st: "SUCCESS", stBg: T.success100, stFg: T.success500, ip: "192.168.1.5" },
    { z: "05.05 09:00", k: "Sistem", r: "—", m: "Cron", kayit: "Görev Üretimi", is: "12 Görev Üretildi", oz: "T-3, T-7, T-15 kurallarından", st: "CREATED", stBg: T.info100, stFg: T.info500, ip: "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="audit" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sistem / AuditLog</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>İşlem Geçmişi / AuditLog</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Kullanıcı işlemleri, kayıt değişiklikleri, import onayları, ödeme işaretlemeleri ve sistem olayları.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">📊 Rapor Al</Btn>
              <Btn variant="secondary" size="md">🚨 Kritik İşlemler</Btn>
              <Btn variant="secondary" size="md">💾 Filtre Kaydet</Btn>
              <Btn variant="primary" size="md">📥 Audit Export</Btn>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.c, marginTop: 6 }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* FILTER */}
          <Card pad={14} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", flex: "1 1 220px", minWidth: 200, color: T.muted, fontSize: 13 }}>
                {Ico.search}<span>Kullanıcı, kayıt, işlem...</span>
              </div>
              {["📅 05.05.2026", "Kullanıcı: Tümü ▾", "Rol: Tümü ▾", "Modül: Tümü ▾", "İşlem: Tümü ▾", "Sonuç: Tümü ▾"].map((c) => (
                <div key={c} style={{ height: 32, padding: "0 10px", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", fontSize: 12, color: T.ink2 }}>{c}</div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 8, background: T.danger100, color: T.danger500, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 28, height: 16, background: T.border, borderRadius: 9999, position: "relative" }}>
                  <span style={{ position: "absolute", left: 2, top: 2, width: 12, height: 12, background: "#fff", borderRadius: 9999 }} />
                </span>
                Kritik
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 8, background: T.danger100, color: T.danger500, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 28, height: 16, background: T.border, borderRadius: 9999, position: "relative" }}>
                  <span style={{ position: "absolute", left: 2, top: 2, width: 12, height: 12, background: "#fff", borderRadius: 9999 }} />
                </span>
                Hatalı
              </div>
              <Btn variant="ghost" size="sm">Temizle</Btn>
            </div>
          </Card>

          {/* TABLO + DRAWER */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, marginBottom: 16 }}>
            <Card pad={0}>
              <div style={{ display: "grid", gridTemplateColumns: "110px 110px 100px 100px 1.2fr 1fr 100px 100px 30px", gap: 6, padding: "10px 14px", background: "#FAFBFC", fontSize: 9, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
                <div>Zaman</div><div>Kullanıcı</div><div>Rol</div><div>Modül</div><div>Kayıt / İşlem</div><div>Özet</div><div>Sonuç</div><div>IP</div><div></div>
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 110px 100px 100px 1.2fr 1fr 100px 100px 30px", gap: 6, padding: "12px 14px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 11, background: r.sel ? T.brand100 : r.st === "CRITICAL" ? T.danger100 + "60" : "#fff" }}>
                  <div style={{ fontFamily: MONO, color: T.ink2, fontSize: 10 }}>{r.z}</div>
                  <div style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>{r.k}</div>
                  <div style={{ fontSize: 10, color: T.ink2 }}>{r.r}</div>
                  <div><span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: T.brand100, color: T.brand700, textTransform: "uppercase" }}>{r.m}</span></div>
                  <div>
                    <div style={{ fontSize: 11, color: T.ink, fontWeight: 600 }}>{r.is}</div>
                    <div style={{ fontSize: 10, color: T.brand700, fontFamily: MONO, marginTop: 1 }}>📎 {r.kayit}</div>
                  </div>
                  <div style={{ fontSize: 11, color: T.ink2 }}>{r.oz}</div>
                  <div><StatusTag label={r.st} bg={r.stBg} fg={r.stFg} pulse={r.st === "FAILED" || r.st === "CRITICAL"} /></div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: MONO }}>{r.ip}</div>
                  <div><button style={{ width: 22, height: 22, border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 11 }}>⋯</button></div>
                </div>
              ))}
            </Card>

            {/* DRAWER */}
            <Card pad={0} style={{ height: "fit-content" }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.success100 }}>
                <StatusTag label="SUCCESS" bg="#fff" fg={T.success500} />
                <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginTop: 8 }}>Import · 46 Satır Onayladı</div>
                <div style={{ fontSize: 11, color: T.ink2, marginTop: 2, fontFamily: MONO }}>05.05.2026 13:45:22</div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Kullanıcı</div>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, marginTop: 2 }}>👤 Müdür</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Rol</div>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, marginTop: 2 }}>Muhasebe Müd.</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>IP / Cihaz</div>
                    <div style={{ fontSize: 11, color: T.ink, fontWeight: 600, marginTop: 2, fontFamily: MONO }}>192.168.1.10</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Modül</div>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, marginTop: 2 }}>Import</div>
                  </div>
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>İşlem Özeti</div>
                <div style={{ padding: 10, background: T.bg, borderRadius: 6, fontSize: 12, color: T.ink, marginBottom: 14, lineHeight: 1.5 }}>
                  SiteX Mayıs ayı ekstreleri RAR import'u onaylandı. <br/>
                  <b>5 daire × 2 belge = 10 PDF</b> + 5 ekstre kaydı + 5 görev oluşturuldu.
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Eski → Yeni Değer</div>
                <div style={{ padding: 10, background: T.bg, borderRadius: 6, marginBottom: 14, fontSize: 11, fontFamily: MONO }}>
                  <div style={{ color: T.danger500, marginBottom: 4 }}>− status: ON_IZLEME</div>
                  <div style={{ color: T.success500 }}>+ status: ONAYLANDI</div>
                  <div style={{ color: T.muted, marginTop: 4 }}>+ committed_records: 46</div>
                  <div style={{ color: T.muted }}>+ committed_at: 13:45:22</div>
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Bağlı Kayıt</div>
                <div style={{ padding: 10, border: `1px solid ${T.border}`, borderRadius: 6, marginBottom: 12, background: T.brand100, cursor: "pointer" }}>
                  <div style={{ fontSize: 11, color: T.brand700, fontWeight: 700 }}>📎 ImportBatch / SITEX_2026-04</div>
                  <div style={{ fontSize: 10, color: T.ink2, marginTop: 2, fontFamily: MONO }}>10 dosya · 46 satır · 2.4 MB</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Btn variant="primary" size="sm" style={{ justifyContent: "center" }}>📂 Kayda Git</Btn>
                  <Btn variant="secondary" size="sm" style={{ justifyContent: "center" }}>↩ Rollback (24sa içinde)</Btn>
                  <Btn variant="ghost" size="sm" style={{ justifyContent: "center" }}>+ Görev Oluştur</Btn>
                </div>
              </div>
            </Card>
          </div>

          {/* ALT: TREND CHART + MODÜL DAĞILIM + KRİTİK UYARI */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16 }}>
            <Card pad={16}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 12 }}>Günlük İşlem Trendi (Son 14 gün)</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
                {[180, 220, 195, 240, 280, 198, 210, 245, 265, 220, 198, 230, 248, 260].map((v, i) => (
                  <div key={i} style={{ flex: 1, height: `${(v / 280) * 100}%`, background: i === 13 ? T.brand700 : T.brand500, borderRadius: 2, opacity: i === 13 ? 1 : 0.7 }} title={`${v} işlem`} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.muted, marginTop: 6, fontFamily: MONO }}>
                <span>22.04</span><span>29.04</span><span style={{ color: T.brand700, fontWeight: 700 }}>05.05</span>
              </div>
            </Card>

            <Card pad={16}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900, marginBottom: 12 }}>Modül Bazlı İşlem</div>
              {[
                ["Fatura/Ödeme", 32, T.brand700],
                ["SiteX", 18, T.brand500],
                ["Import", 12, T.info500],
                ["Teminat", 8, T.warning500],
                ["Görev", 24, T.success500],
              ].map(([n, c, color]) => (
                <div key={n} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: T.ink, fontWeight: 600 }}>{n}</span>
                    <span style={{ color: T.ink2, fontFamily: MONO, fontWeight: 700 }}>{c}%</span>
                  </div>
                  <div style={{ height: 6, background: T.border, borderRadius: 9999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${c}%`, background: color }} />
                  </div>
                </div>
              ))}
            </Card>

            <Card pad={16} style={{ borderLeft: `4px solid ${T.danger500}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.danger500, marginBottom: 12 }}>🚨 Kritik İşlemler (Bugün)</div>
              {[
                ["Super Admin · Rol Güncelledi", "Ayşe → Muhasebeci+Export", "13:20"],
                ["Müdür · Hard-Delete", "Test fatura silindi", "11:00"],
                ["Sistem · Yetki Reddi", "Erdal yetkisiz erişim", "10:42"],
              ].map(([t, d, z], i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: i < 2 ? `1px solid ${T.border}` : "none", fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: T.ink, fontWeight: 600 }}>{t}</span>
                    <span style={{ color: T.muted, fontFamily: MONO }}>{z}</span>
                  </div>
                  <div style={{ color: T.ink2, marginTop: 2, fontSize: 10 }}>{d}</div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   FRAME 19 — 19 Yetki Yönetimi & Master Tablolar
   ============================================================ */
function YetkiMasterFrame() {
  const MONO = "'IBM Plex Mono', ui-monospace, monospace";
  const kpis = [
    { l: "Aktif Kullanıcı", v: "8", c: T.brand900 },
    { l: "Rol Sayısı", v: "6", c: T.brand700 },
    { l: "Şirket / Şahıs", v: "10 / 8", c: T.brand900 },
    { l: "Mülk", v: "12", c: T.brand700 },
    { l: "Kontrol Gerekli", v: "1", c: T.purple500 },
    { l: "Son Yetki Değ.", v: "13:20", c: T.warning500, mono: true },
  ];

  const users = [
    { ad: "Muhasebe Müdürü", rol: "Muh. Müdürü", durum: "Aktif", mod: 16, imp: true, ode: true, exp: true, son: "Bugün 13:55" },
    { ad: "Ayşe Demir", rol: "Muhasebeci+Export", durum: "Aktif", mod: 12, imp: false, ode: true, exp: true, son: "Bugün 14:32", sel: true },
    { ad: "Erdal Yıldız", rol: "Muhasebeci", durum: "Aktif", mod: 10, imp: false, ode: true, exp: false, son: "Bugün 14:18" },
    { ad: "Melek Aksoy", rol: "Muhasebeci", durum: "Aktif", mod: 10, imp: false, ode: true, exp: false, son: "Bugün 12:55" },
    { ad: "Yönetici", rol: "Yönetici", durum: "Aktif", mod: 16, imp: true, ode: true, exp: true, son: "Bugün 09:15" },
    { ad: "Super Admin", rol: "Super Admin", durum: "Aktif", mod: 16, imp: true, ode: true, exp: true, son: "Bugün 13:20" },
  ];

  const moduller = ["Fatura", "Ödeme", "Import", "SiteX", "Emlak", "Teminat", "Resmi Öd.", "Entegratör", "Raporlama", "AuditLog"];
  const yetkiler = ["Görüntüle", "Ekle", "Düzenle", "Onayla", "Export", "Görev Ata", "Chat"];
  // matrix: ✓ / ⛔ / partial — Ayşe için
  const matrix = {
    "Fatura":     ["✓", "✓", "✓", "—", "✓", "✓", "✓"],
    "Ödeme":      ["✓", "✓", "✓", "—", "✓", "✓", "✓"],
    "Import":     ["✓", "✓", "—", "⛔", "—", "—", "✓"],
    "SiteX":    ["✓", "✓", "✓", "—", "✓", "✓", "✓"],
    "Emlak":      ["✓", "✓", "✓", "—", "✓", "—", "✓"],
    "Teminat":    ["✓", "—", "—", "—", "—", "—", "✓"],
    "Resmi Öd.":  ["✓", "✓", "✓", "—", "✓", "—", "✓"],
    "Entegratör": ["✓", "—", "—", "—", "—", "—", "—"],
    "Raporlama":  ["✓", "—", "—", "—", "✓", "—", "—"],
    "AuditLog":   ["—", "—", "—", "—", "—", "—", "—"],
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SideNav active="yetki" />
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: T.bg, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sistem / Yetki & Master</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.brand900, margin: "6px 0 0" }}>Yetki Yönetimi & Master Tablolar</h1>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>Kullanıcı, rol, şirket, şahıs, mülk ve referans veri yönetimi.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="md">🧪 Yetki Testi</Btn>
              <Btn variant="secondary" size="md">+ Yeni Master</Btn>
              <Btn variant="secondary" size="md">+ Yeni Şirket</Btn>
              <Btn variant="primary" size="md">{Ico.plus} Yeni Kullanıcı</Btn>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <Card key={k.l} pad={14}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.c, marginTop: 6, fontFamily: k.mono ? MONO : "inherit" }}>{k.v}</div>
              </Card>
            ))}
          </div>

          {/* TABS */}
          <Card pad={0} style={{ marginBottom: 14 }}>
            <div style={{ padding: "0 16px", display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, overflowX: "auto" }}>
              {[
                ["Kullanıcılar", true, 8],
                ["Roller", false, 6],
                ["Şirketler", false, 10],
                ["Şahıslar", false, 8],
                ["Mülkler", false, 12],
                ["Bankalar", false, 5],
                ["Kurumlar", false, 14],
                ["Kategoriler", false, 22],
                ["Yetki Simülasyonu", false, null],
              ].map(([l, a, c]) => (
                <div key={l} style={{ padding: "12px 14px", fontSize: 12, fontWeight: a ? 700 : 500, color: a ? T.brand900 : T.ink2, borderBottom: a ? `2px solid ${T.brand700}` : "2px solid transparent", marginBottom: -1, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                  {l}
                  {c !== null && <span style={{ padding: "1px 6px", background: a ? T.brand700 : T.border, color: a ? "#fff" : T.ink2, borderRadius: 9999, fontSize: 9, fontWeight: 700 }}>{c}</span>}
                </div>
              ))}
            </div>
          </Card>

          {/* KULLANICI TABLOSU + PERMISSION MATRIX */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: 16, marginBottom: 16 }}>
            <Card pad={0}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 13, fontWeight: 700, color: T.brand900 }}>Kullanıcılar</div>
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 70px 70px 60px 60px 60px 100px 50px", gap: 6, padding: "10px 14px", background: "#FAFBFC", fontSize: 9, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
                <div>Kullanıcı</div><div>Rol</div><div>Durum</div><div>Modül</div><div>Import</div><div>Ödeme</div><div>Export</div><div>Son Giriş</div><div></div>
              </div>
              {users.map((u, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 70px 70px 60px 60px 60px 100px 50px", gap: 6, padding: "12px 14px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 11, background: u.sel ? T.brand100 : "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 9999, background: T.brand500, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{u.ad[0]}</span>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>{u.ad}</div>
                  </div>
                  <div style={{ fontSize: 11, color: T.ink2 }}>{u.rol}</div>
                  <div><StatusTag label="AKTİF" bg={T.success100} fg={T.success500} /></div>
                  <div style={{ fontFamily: MONO, color: T.ink, fontWeight: 600, fontSize: 11 }}>{u.mod}/16</div>
                  <div style={{ textAlign: "center", color: u.imp ? T.success500 : T.muted, fontWeight: 700 }}>{u.imp ? "✓" : "⛔"}</div>
                  <div style={{ textAlign: "center", color: u.ode ? T.success500 : T.muted, fontWeight: 700 }}>{u.ode ? "✓" : "⛔"}</div>
                  <div style={{ textAlign: "center", color: u.exp ? T.success500 : T.muted, fontWeight: 700 }}>{u.exp ? "✓" : "⛔"}</div>
                  <div style={{ fontSize: 10, color: T.ink2, fontFamily: MONO }}>{u.son}</div>
                  <div><button style={{ width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 4, background: "#fff", color: T.ink2, cursor: "pointer", fontSize: 11 }}>⋯</button></div>
                </div>
              ))}
            </Card>

            {/* PERMISSION MATRIX */}
            <Card pad={0}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.brand100 }}>
                <div style={{ fontSize: 11, color: T.brand500, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Yetki Matrisi</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, marginTop: 2 }}>Ayşe Demir · Muhasebeci+Export</div>
              </div>
              <div style={{ padding: 12 }}>
                {/* HEADER */}
                <div style={{ display: "grid", gridTemplateColumns: "100px repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                  <div></div>
                  {yetkiler.map((y) => (
                    <div key={y} style={{ fontSize: 8, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center", padding: "4px 0", writingMode: "vertical-rl", transform: "rotate(180deg)", height: 60 }}>{y}</div>
                  ))}
                </div>
                {/* ROWS */}
                {moduller.map((m) => (
                  <div key={m} style={{ display: "grid", gridTemplateColumns: "100px repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
                    <div style={{ fontSize: 11, color: T.ink, fontWeight: 600, padding: "6px 4px" }}>{m}</div>
                    {matrix[m].map((v, i) => (
                      <div key={i} style={{ aspectRatio: "1", borderRadius: 3, background: v === "✓" ? T.success100 : v === "⛔" ? T.danger100 : T.bg, color: v === "✓" ? T.success500 : v === "⛔" ? T.danger500 : T.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, border: `1px solid ${v === "✓" ? T.success500 + "30" : v === "⛔" ? T.danger500 + "30" : T.border}` }}>{v}</div>
                    ))}
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: 10, background: T.bg, borderRadius: 6, fontSize: 10, color: T.ink2, fontWeight: 600, display: "flex", gap: 12 }}>
                  <span><b style={{ color: T.success500 }}>✓</b> İzin var</span>
                  <span><b style={{ color: T.muted }}>—</b> Geçerli değil</span>
                  <span><b style={{ color: T.danger500 }}>⛔</b> Yasak</span>
                </div>
              </div>
            </Card>
          </div>

          {/* MASTER TABLO PREVIEW */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <Card pad={0}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900 }}>Şirketler (10)</div>
                <Btn variant="ghost" size="sm">+ Ekle</Btn>
              </div>
              {[
                ["Acme Enerji Üretim A.Ş.", "Şirket", "1234567890"],
                ["Acme Tekstil San. Ltd. Şti.", "Şirket", "0987654321"],
                ["Beta Tekstil Tekstil", "Şirket", "5566778899"],
                ["KC İplik San. ve Tic.", "Şirket", "1122334455"],
                ["MDT Doğal Kaynaklar", "Şirket", "9988776655"],
              ].map((r, i) => (
                <div key={i} style={{ padding: "10px 16px", borderBottom: i < 4 ? `1px solid ${T.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>{r[0]}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: MONO }}>{r[2]}</div>
                </div>
              ))}
            </Card>

            <Card pad={0}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900 }}>Şahıslar (8)</div>
                <Btn variant="ghost" size="sm">+ Ekle</Btn>
              </div>
              {[
                ["Test Kullanıcı", "143 354 565 62"],
                ["Mehmet Rahim Acme", "258 670 722 98"],
                ["Mehmet Ali Acme", "259 030 710 18"],
                ["Ali Acme", "259 420 697 48"],
                ["Kaan Acme", "259 630 690 00"],
              ].map((r, i) => (
                <div key={i} style={{ padding: "10px 16px", borderBottom: i < 4 ? `1px solid ${T.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>{r[0]}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: MONO }}>TC ***{r[1].slice(-4)}</div>
                </div>
              ))}
            </Card>

            <Card pad={0}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900 }}>Mülk / Site (12)</div>
                <Btn variant="ghost" size="sm">+ Ekle</Btn>
              </div>
              {[
                ["SiteX A4.17", "Test K.", "Bakırköy"],
                ["SiteX A4.22", "Mehmet R.", "Bakırköy"],
                ["Bayrampaşa Mega Center", "K. Tekstil", "Bayrampaşa"],
                ["Yalova Termal", "Ali K.", "Termal"],
                ["Fatih İş Yeri", "Mehmet R.", "Fatih"],
              ].map((r, i) => (
                <div key={i} style={{ padding: "10px 16px", borderBottom: i < 4 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>{r[0]}</div>
                  <div style={{ fontSize: 10, color: T.ink2, marginTop: 2 }}>{r[1]} · {r[2]}</div>
                </div>
              ))}
            </Card>
          </div>

          {/* YETKİ SİMÜLASYONU + RİSK */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
            <Card pad={16} style={{ borderLeft: `3px solid ${T.brand700}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900 }}>🧪 Yetki Simülasyonu</div>
                  <div style={{ fontSize: 11, color: T.ink2, marginTop: 2 }}>Kullanıcı + kayıt + işlem sorgusu — sonuç: izin / red / kısmi</div>
                </div>
                <Btn variant="ghost" size="sm">Yeni Test</Btn>
              </div>
              <div style={{ padding: 12, background: T.bg, borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: T.brand900, fontWeight: 600, lineHeight: 1.6 }}>
                  <span style={{ padding: "2px 8px", background: T.brand700, color: "#fff", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>Ayşe</span>
                  {" · "}
                  <span style={{ padding: "2px 8px", background: T.purple100, color: T.purple500, borderRadius: 4, fontWeight: 700, fontSize: 11 }}>SiteX / B3.31</span>
                  {" · "}
                  <span style={{ padding: "2px 8px", background: "#fff", border: `1px solid ${T.border}`, color: T.ink, borderRadius: 4, fontWeight: 700, fontSize: 11 }}>dekont görüntüleme</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  ["Görüntüleme", "✓ İzin", T.success500, T.success100],
                  ["Düzenleme", "✓ İzin", T.success500, T.success100],
                  ["Export", "⛔ Red — rol yetkisi yok", T.danger500, T.danger100],
                ].map(([l, r, c, b]) => (
                  <div key={l} style={{ padding: 10, background: b, borderRadius: 6, borderLeft: `3px solid ${c}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c, marginTop: 4 }}>{r}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card pad={16} style={{ borderLeft: `3px solid ${T.danger500}`, background: T.danger100 + "30" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.danger500, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>🛡 Risk Uyarısı</div>
              <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.6 }}>
                <b>Super Admin</b> dışında <b>gerçek Telegram açma</b> yetkisi yok. Yetki değişikliği yapmadan önce AuditLog'u kontrol edin.
              </div>
              <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 6, fontSize: 11, color: T.ink2 }}>
                <div style={{ fontWeight: 700, color: T.brand900, marginBottom: 4 }}>Kritik Yetkiler</div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Hard-Delete</span><span style={{ color: T.brand700, fontWeight: 700 }}>Super Admin</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Telegram Gerçek</span><span style={{ color: T.brand700, fontWeight: 700 }}>Super Admin</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Rol Atama</span><span style={{ color: T.brand700, fontWeight: 700 }}>Super Admin</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Import Commit</span><span style={{ color: T.ink2, fontWeight: 600 }}>Müdür+Yönetici</span></div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <ChatWidgetCollapsed />
    </div>
  );
}

/* ============================================================
   SPRINT 1G — MOBİL YARDIMCILAR (430×932 iPhone Pro Max)
   ============================================================ */
const MMONO = "'IBM Plex Mono', ui-monospace, monospace";

function MobileFrame({ children, bg }) {
  return (
    <div style={{ width: "100%", height: "100%", background: bg || T.bg, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* iOS status bar */}
      <div style={{ height: 44, background: T.brand900, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", fontSize: 14, fontWeight: 600, fontFamily: MMONO }}>
        <span>09:41</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
          <span>●●●●</span>
          <span>5G</span>
          <span style={{ width: 22, height: 11, border: "1.5px solid #fff", borderRadius: 2, padding: 1 }}>
            <span style={{ display: "block", width: "85%", height: "100%", background: "#fff", borderRadius: 1 }} />
          </span>
        </span>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
      {/* iOS home indicator */}
      <div style={{ height: 24, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: 134, height: 5, background: T.ink, borderRadius: 9999 }} />
      </div>
    </div>
  );
}

function MobileTopBar({ title, sub, back }) {
  return (
    <div style={{ height: 56, background: "#fff", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 12px", gap: 8, flexShrink: 0 }}>
      {back ? (
        <button style={{ width: 44, height: 44, border: "none", background: "transparent", color: T.brand700, fontSize: 22, cursor: "pointer" }}>‹</button>
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.brand700, color: T.accent500, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, marginLeft: 4 }}>K</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.brand900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: T.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </div>
      <button style={{ width: 44, height: 44, border: "none", background: "transparent", color: T.ink2, position: "relative", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {Ico.bell}
        <span style={{ position: "absolute", top: 8, right: 8, width: 14, height: 14, borderRadius: 9999, background: T.danger500, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>5</span>
      </button>
      <button style={{ width: 44, height: 44, border: "none", background: "transparent", color: T.ink2, fontSize: 22, cursor: "pointer" }}>☰</button>
    </div>
  );
}

function MobileChatFab() {
  return (
    <div style={{ position: "absolute", right: 16, bottom: 96, width: 56, height: 56, borderRadius: 9999, background: T.brand700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 32px rgba(15,37,64,0.20)", cursor: "pointer", zIndex: 10 }}>
      {Ico.msg}
      <div style={{ position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: 9999, background: T.danger500, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>3</div>
    </div>
  );
}

function MStatusTag({ label, bg, fg, pulse }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 8px", borderRadius: 9999, background: bg, color: fg, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: 9999, background: fg, boxShadow: pulse ? `0 0 0 3px ${bg}` : "none" }} />
      {label}
    </span>
  );
}

function MoneyM(n) {
  return "₺ " + n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ============================================================
   FRAME 20 — Mobile Dashboard
   ============================================================ */
function MobileDashboardFrame() {
  return (
    <MobileFrame>
      <MobileTopBar title="Muhasebe Operasyon" sub="5 Mayıs 2026" />
      <div style={{ flex: 1, overflowY: "auto", padding: 16, paddingBottom: 80 }}>
        {/* ARAMA */}
        <div style={{ height: 44, border: `1px solid ${T.border}`, borderRadius: 10, background: "#fff", padding: "0 14px", display: "flex", alignItems: "center", gap: 8, color: T.muted, fontSize: 16, marginBottom: 16 }}>
          {Ico.search}<span>Ara — fatura, kurum, görev...</span>
        </div>

        {/* 2x2 KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            ["Bugün Ödenecek", MoneyM(48750.25), T.brand900, "12 kalem", true],
            ["Geciken", MoneyM(112430), T.danger500, "7 kalem", true],
            ["Görevler", "%72", T.success500, "18/25 tamam"],
            ["Eksik Dekont", "9", T.orange500, "5K+ TL"],
          ].map(([l, v, c, d, mono]) => (
            <Card key={l} pad={14}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c, marginTop: 6, fontFamily: mono ? MMONO : "inherit" }}>{v}</div>
              <div style={{ fontSize: 11, color: T.ink2, marginTop: 4 }}>{d}</div>
            </Card>
          ))}
        </div>

        {/* RİSK SCROLL */}
        <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Risk Kartları</div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", marginBottom: 16, marginLeft: -16, marginRight: -16, padding: "0 16px", scrollSnapType: "x mandatory" }}>
          {[
            ["Kontör Kritik", "Acme Enerji · 420/5000", T.danger500],
            ["SiteX T-3", "B2.28 ödeme · 17.05", T.warning500],
            ["Teminat T-7", "Albaraka 71-D8-3842", T.orange500],
            ["Emlak 1.Tk", "Bayrampaşa M.C. · 31.05", T.danger500],
          ].map(([l, d, c]) => (
            <div key={l} style={{ minWidth: 240, flexShrink: 0, padding: 14, background: "#fff", borderRadius: 12, border: `1px solid ${T.border}`, borderLeft: `4px solid ${c}`, scrollSnapAlign: "start" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{l}</div>
              <div style={{ fontSize: 12, color: T.ink2, marginTop: 6 }}>{d}</div>
            </div>
          ))}
        </div>

        {/* BUGÜNKÜ GÖREVLER */}
        <Card pad={14} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900 }}>Bugünkü Görevlerim</div>
            <span style={{ fontSize: 11, color: T.brand700, fontWeight: 600 }}>Tümü →</span>
          </div>
          {[
            ["SiteX A4.17 ekstre indir", T.danger500, "ACIL"],
            ["İTO 1. taksit ödeme", T.orange500, "YÜKSEK"],
            ["Eksik dekont yükle (3)", T.info500, "NORMAL"],
          ].map(([t, c, p], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none", minHeight: 44 }}>
              <div style={{ width: 4, height: 28, background: c, borderRadius: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13, color: T.ink, fontWeight: 500 }}>{t}</div>
              <span style={{ fontSize: 9, color: c, fontWeight: 700, letterSpacing: "0.04em" }}>{p}</span>
            </div>
          ))}
        </Card>

        {/* YAKLAŞAN ÖDEMELER */}
        <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Yaklaşan Ödemeler</div>
        {[
          ["Türk Telekom · Ev İnt.", "20.05", 683.6, T.warning500],
          ["CK Boğaziçi · Florya", "15.05", 3630, T.orange500],
          ["SiteX A4.22 Aidat", "22.05", 28344, T.warning500],
        ].map(([k, d, a, c], i) => (
          <Card key={i} pad={12} style={{ marginBottom: 8, borderLeft: `3px solid ${c}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</div>
                <div style={{ fontSize: 11, color: T.ink2, marginTop: 2, fontFamily: MMONO }}>{d}.2026</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, fontFamily: MMONO }}>{MoneyM(a)}</div>
            </div>
          </Card>
        ))}

        {/* IMPORT BEKLEYEN UYARI */}
        <div style={{ marginTop: 12, padding: 14, background: T.info100, borderRadius: 10, border: `1px solid ${T.info500}30`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9999, background: T.info500, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>⬆</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.info500 }}>Import Bekleyenler · 2</div>
            <div style={{ fontSize: 11, color: T.ink2, marginTop: 2 }}>EV_ABONELIKLERI.xlsx + SITEX_2026-04.rar</div>
          </div>
          <button style={{ height: 44, padding: "0 14px", background: T.info500, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Aç</button>
        </div>
      </div>

      {/* BOTTOM TAB BAR */}
      <div style={{ height: 64, background: "#fff", borderTop: `1px solid ${T.border}`, display: "flex", flexShrink: 0 }}>
        {[
          ["📊", "Dashboard", true],
          ["💳", "Ödemeler", false],
          ["📅", "Görev", false],
          ["⬆", "Import", false],
          ["⋯", "Daha", false],
        ].map(([ic, l, a]) => (
          <div key={l} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: a ? T.brand700 : T.ink2, gap: 2, cursor: "pointer", borderTop: a ? `2px solid ${T.brand700}` : "2px solid transparent", marginTop: -1 }}>
            <span style={{ fontSize: 20 }}>{ic}</span>
            <span style={{ fontSize: 10, fontWeight: a ? 700 : 500 }}>{l}</span>
          </div>
        ))}
      </div>
      <MobileChatFab />
    </MobileFrame>
  );
}

/* ============================================================
   FRAME 21 — Mobile Bugünkü Görevler
   ============================================================ */
function MobileTasksFrame() {
  return (
    <MobileFrame>
      <MobileTopBar title="Bugünkü Görevlerim" sub="8 görev · 3 yaklaşan" />
      {/* TABS */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 6, padding: "10px 12px", overflowX: "auto", flexShrink: 0 }}>
        {[
          ["Bugün", true, 8],
          ["Yaklaşan", false, 14],
          ["Geciken", false, 3],
          ["Bana", false, 5],
          ["Atadıklarım", false, 12],
        ].map(([l, a, c]) => (
          <div key={l} style={{ minHeight: 36, padding: "8px 12px", borderRadius: 9999, background: a ? T.brand700 : T.bg, color: a ? "#fff" : T.ink2, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: "pointer" }}>
            {l}<span style={{ padding: "1px 6px", background: a ? "rgba(255,255,255,0.2)" : T.border, color: a ? "#fff" : T.ink2, borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>{c}</span>
          </div>
        ))}
      </div>

      {/* FILTRE BUTONU + SWIPE İPUCU */}
      <div style={{ padding: "10px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button style={{ minHeight: 44, padding: "0 14px", border: `1px solid ${T.border}`, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.ink2 }}>
          ⚙ Filtre <span style={{ padding: "1px 6px", background: T.brand700, color: "#fff", borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>2</span>
        </button>
        <div style={{ fontSize: 10, color: T.muted }}>← Ertele · Tamamla →</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, paddingBottom: 96 }}>
        {[
          { t: "SiteX A4.17 Mayıs aidat ekstre kontrolü", b: "SiteX / A4.17 / 2026-05", at: "M", an: "A", anC: T.success500, son: "20.05.2026", days: "+6 gün", st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, onc: T.warning500, y: 3, e: 1 },
          { t: "Albaraka 71-D8-3842 komisyon dekontu", b: "Teminat / 71-D8-3842", at: "Y", an: "E", anC: T.info500, son: "12.05.2026", days: "−2 gün", st: "GECİKTİ", stBg: T.danger100, stFg: T.danger500, onc: T.danger500, y: 2, e: 0, sw: true },
          { t: "Türk Telekom PDF faturasını import et", b: "Fatura / TT-2026-0419", at: "A", an: "M", anC: T.purple500, son: "Bugün", days: "0", st: "GÖREV AÇIK", stBg: T.info100, stFg: T.info500, onc: T.info500, y: 0, e: 0 },
          { t: "BAĞKUR Mayıs dekont kontrolü", b: "Resmi / BAĞKUR / 2026-05", at: "M", an: "A", anC: T.success500, son: "31.05.2026", days: "+17", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, onc: T.warning500, y: 1, e: 0 },
        ].map((t, i) => (
          <Card key={i} pad={14} style={{ marginBottom: 10, borderLeft: `4px solid ${t.onc}`, position: "relative", overflow: "hidden" }}>
            {t.sw && (
              <>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: T.warning500, opacity: 0.2 }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 32, background: T.success500, opacity: 0.15, display: "flex", alignItems: "center", justifyContent: "center", color: T.success500, fontSize: 16, fontWeight: 700 }}>✓</div>
              </>
            )}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <button style={{ width: 24, height: 24, border: `2px solid ${T.border}`, borderRadius: 6, background: "#fff", flexShrink: 0, marginTop: 2, cursor: "pointer" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                  <MStatusTag label={t.st} bg={t.stBg} fg={t.stFg} pulse={t.st === "GECİKTİ"} />
                  <span style={{ fontSize: 10, color: t.days.includes("−") ? T.danger500 : T.ink2, fontWeight: 700, fontFamily: MMONO }}>{t.son} · {t.days}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, lineHeight: 1.4 }}>{t.t}</div>
                <div style={{ fontSize: 11, color: T.brand700, marginTop: 6 }}>📎 {t.b}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 22, height: 22, borderRadius: 9999, background: T.brand500, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>{t.at}</span>
                <span style={{ fontSize: 14, color: T.muted }}>→</span>
                <span style={{ width: 26, height: 26, borderRadius: 9999, background: t.anC, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{t.an}</span>
              </div>
              <div style={{ fontSize: 11, color: T.muted, display: "flex", gap: 8 }}>💬 {t.y} · 📎 {t.e}</div>
              <div style={{ flex: 1 }} />
              <button style={{ minHeight: 36, padding: "0 12px", border: `1px solid ${T.success500}`, color: T.success500, borderRadius: 8, background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ Tamamla</button>
              <button style={{ width: 36, height: 36, border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14 }}>⏰</button>
            </div>
          </Card>
        ))}
      </div>

      {/* FAB */}
      <div style={{ position: "absolute", right: 16, bottom: 28, width: 56, height: 56, borderRadius: 9999, background: T.accent500, color: T.brand900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 32px rgba(15,37,64,0.20)", cursor: "pointer", fontSize: 24, fontWeight: 800 }}>+</div>
      <MobileChatFab />
    </MobileFrame>
  );
}

/* ============================================================
   FRAME 22 — Mobile Ödeme Listesi
   ============================================================ */
function MobilePaymentListFrame() {
  const items = [
    { sahip: "Acme Enerji", kurum: "Türk Telekom · İnternet", per: "2026-05", son: "20.05.2026", t: 12430.5, met: "OTOMATIK", st: "YAKLAŞIYOR", stBg: T.orange100, stFg: T.orange500, dek: false, gor: 1 },
    { sahip: "Test Kullanıcı", kurum: "SiteX B3.31 · Aidat", per: "2026-05", son: "20.05.2026", t: 18750, met: "EFT", st: "BEKLİYOR", stBg: T.warning100, stFg: T.warning500, dek: false, gor: 0 },
    { sahip: "Beta Tekstil", kurum: "SMMM Hizmeti", per: "2026-05", son: "10.05.2026", t: 25000, met: "EFT", st: "GECİKTİ", stBg: T.danger100, stFg: T.danger500, dek: false, gor: 1 },
    { sahip: "Ali Acme", kurum: "İGDAŞ · Doğalgaz", per: "2026-05", son: "17.05.2026", t: 3450.75, met: "OTOMATIK", st: "DEKONT EKSİK", stBg: T.orange100, stFg: T.orange500, dek: false, gor: 1 },
    { sahip: "Acme Tekstil", kurum: "CK Boğaziçi · Elektrik", per: "2026-05", son: "15.05.2026", t: 86220.4, met: "OTOMATIK", st: "ÖDENDİ", stBg: T.success100, stFg: T.success500, dek: true, gor: 0 },
  ];

  return (
    <MobileFrame>
      <MobileTopBar title="Fatura & Ödeme" sub="186 kayıt · 12 bugün" />
      <div style={{ padding: 16, background: "#fff", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ height: 48, border: `1px solid ${T.border}`, borderRadius: 10, background: T.bg, padding: "0 14px", display: "flex", alignItems: "center", gap: 8, color: T.muted, fontSize: 16, marginBottom: 10 }}>
          {Ico.search}<span>Sahip, kurum, fatura no...</span>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginLeft: -16, marginRight: -16, padding: "0 16px" }}>
          {[
            ["Tümü", true, 186],
            ["Geciken", false, 7],
            ["Bugün", false, 12],
            ["7 Gün", false, 23],
            ["Eksik Dekont", false, 9],
          ].map(([l, a, c]) => (
            <div key={l} style={{ minHeight: 36, padding: "8px 12px", borderRadius: 9999, background: a ? T.brand700 : T.bg, color: a ? "#fff" : T.ink2, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {l}<span style={{ padding: "1px 6px", background: a ? "rgba(255,255,255,0.2)" : T.border, color: a ? "#fff" : T.ink2, borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>{c}</span>
            </div>
          ))}
          <button style={{ minHeight: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 9999, background: "#fff", color: T.ink2, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>⚙</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, paddingBottom: 96 }}>
        {items.map((r, i) => {
          const metMap = { OTOMATIK: [T.info100, T.info500], EFT: [T.success100, T.success500] };
          const [mB, mF] = metMap[r.met] || [T.info100, T.info500];
          return (
            <Card key={i} pad={14} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.brand900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sahip}</div>
                  <div style={{ fontSize: 12, color: T.ink2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.kurum}</div>
                </div>
                <button style={{ width: 36, height: 36, border: "none", background: T.bg, borderRadius: 8, color: T.ink2, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>⋯</button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Son Ödeme</div>
                  <div style={{ fontSize: 13, color: r.st === "GECİKTİ" ? T.danger500 : T.ink, fontWeight: 700, fontFamily: MMONO, marginTop: 2 }}>{r.son}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Tutar</div>
                  <div style={{ fontSize: 18, color: T.brand900, fontWeight: 800, fontFamily: MMONO, marginTop: 2 }}>{MoneyM(r.t)}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                <MStatusTag label={r.st} bg={r.stBg} fg={r.stFg} pulse={r.st === "GECİKTİ"} />
                <MStatusTag label={r.met} bg={mB} fg={mF} />
                {!r.dek && <MStatusTag label="Dek. Eksik" bg={T.orange100} fg={T.orange500} />}
                {r.gor > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", background: T.info100, color: T.info500, borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>📋 {r.gor}</span>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      <div style={{ background: "#fff", borderTop: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", gap: 8, flexShrink: 0 }}>
        <button style={{ flex: 1, height: 48, background: T.brand700, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700 }}>+ Yeni</button>
        <button style={{ flex: 1, height: 48, background: "#fff", color: T.brand700, border: `1px solid ${T.brand700}`, borderRadius: 10, fontSize: 14, fontWeight: 700 }}>⬆ Import</button>
        <button style={{ flex: 1, height: 48, background: "#fff", color: T.ink2, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600 }}>📊 Rapor</button>
      </div>
      <MobileChatFab />
    </MobileFrame>
  );
}

/* ============================================================
   FRAME 23 — Mobile Ödeme Detay & Dekont Yükle
   ============================================================ */
function MobilePaymentDetailFrame() {
  return (
    <MobileFrame>
      <MobileTopBar title="Türk Telekom" sub="Mayıs 2026 · İnternet" back />
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
        {/* ÖZET KART */}
        <div style={{ background: "#fff", padding: 16, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <MStatusTag label="YAKLAŞIYOR" bg={T.orange100} fg={T.orange500} />
            <MStatusTag label="OTOMATIK" bg={T.info100} fg={T.info500} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Tutar</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.brand900, fontFamily: MMONO, marginTop: 2 }}>{MoneyM(12430.5)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Son Ödeme</div>
              <div style={{ fontSize: 14, color: T.danger500, fontWeight: 700, fontFamily: MMONO, marginTop: 2 }}>20.05.2026</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.ink2 }}>Acme Enerji · Hesap: <span style={{ fontFamily: MMONO, color: T.ink }}>7024574723</span></div>
          {/* MİNİ KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
            {[
              ["Ödenen", MoneyM(0), T.muted, true],
              ["Kalan", MoneyM(12430.5), T.danger500, true],
              ["Dekont", "Bekliyor", T.warning500, false],
            ].map(([l, v, c, m]) => (
              <div key={l} style={{ padding: 10, background: T.bg, borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontSize: 12, color: c, fontWeight: 700, fontFamily: m ? MMONO : "inherit", marginTop: 4 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TABS */}
        <div style={{ background: "#fff", borderBottom: `1px solid ${T.border}`, padding: "0 16px", display: "flex", gap: 0, overflowX: "auto" }}>
          {[
            ["Genel", false],
            ["Ödeme", true],
            ["Belgeler", false],
            ["Görev", false, 1],
            ["Chat", false, 3],
            ["Audit", false],
          ].map(([l, a, c]) => (
            <div key={l} style={{ padding: "14px 12px", fontSize: 13, fontWeight: a ? 700 : 500, color: a ? T.brand900 : T.ink2, borderBottom: a ? `2px solid ${T.brand700}` : "2px solid transparent", marginBottom: -1, whiteSpace: "nowrap", cursor: "pointer" }}>
              {l}{c && <span style={{ marginLeft: 4, color: T.muted, fontSize: 11 }}>({c})</span>}
            </div>
          ))}
        </div>

        {/* ÖDEME FORMU */}
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Ödeme Durumu</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              ["✓ Ödendi", true, T.success500],
              ["◐ Kısmi", false, T.warning500],
              ["⚠ Kontrol", false, T.purple500],
            ].map(([l, sel, c]) => (
              <div key={l} style={{ flex: 1, minHeight: 48, padding: "10px 8px", border: `1.5px solid ${sel ? c : T.border}`, borderRadius: 10, background: sel ? c + "15" : "#fff", color: sel ? c : T.ink2, fontWeight: 700, fontSize: 13, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>{l}</div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Ödeme Tarihi</div>
            <div style={{ height: 48, border: `1px solid ${T.border}`, borderRadius: 10, padding: "0 14px", display: "flex", alignItems: "center", background: "#fff", fontSize: 16, fontFamily: MMONO, color: T.ink }}>20.05.2026</div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Ödenen Tutar</div>
            <div style={{ height: 48, border: `1px solid ${T.border}`, borderRadius: 10, padding: "0 14px", display: "flex", alignItems: "center", background: "#fff", fontSize: 16, fontFamily: MMONO, color: T.ink, fontWeight: 600 }}>₺ 12.430,50</div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Ödeme Yöntemi</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {[["OTOMATIK", true], ["EFT", false], ["HAVALE", false], ["ELDEN", false], ["KART", false], ["NAKİT", false]].map(([m, sel]) => (
              <div key={m} style={{ minHeight: 44, padding: "10px 14px", border: `1.5px solid ${sel ? T.brand700 : T.border}`, borderRadius: 9999, background: sel ? T.brand100 : "#fff", color: sel ? T.brand700 : T.ink2, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center" }}>{m}</div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Banka</div>
            <div style={{ height: 48, border: `1px solid ${T.border}`, borderRadius: 10, padding: "0 14px", display: "flex", alignItems: "center", background: "#fff", fontSize: 16, color: T.ink }}>Albaraka Türk ▾</div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Dekont</div>
          <div style={{ padding: "20px 14px", border: `2px dashed ${T.brand500}`, borderRadius: 12, background: T.brand100, textAlign: "center", marginBottom: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 9999, background: "#fff", color: T.brand700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 8 }}>📎</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.brand900 }}>Dekont Yükle</div>
            <div style={{ fontSize: 11, color: T.ink2, marginTop: 4 }}>PDF, JPG, PNG · Maks 10 MB</div>
          </div>
          <button style={{ width: "100%", minHeight: 48, background: T.accent500, color: T.brand900, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", marginBottom: 14 }}>
            📷 Fotoğraf Çek
          </button>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.ink2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Not</div>
            <div style={{ minHeight: 80, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, background: "#fff", fontSize: 16, color: T.muted }}>Açıklama yazın...</div>
          </div>

          <div style={{ padding: 10, background: T.bg, borderRadius: 8, fontSize: 11, color: T.ink2, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            🛡 Bu işlem AuditLog'a kaydedilir.
          </div>
        </div>
      </div>

      {/* STICKY ACTION */}
      <div style={{ background: "#fff", borderTop: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
        <button style={{ width: "100%", minHeight: 52, background: T.brand700, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700 }}>Kaydet</button>
        <button style={{ width: "100%", minHeight: 48, background: T.success500, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700 }}>✓ Kaydet ve Görevi Tamamla</button>
      </div>
    </MobileFrame>
  );
}

/* ============================================================
   FRAME 24 — Mobile Import Kontrol
   ============================================================ */
function MobileImportFrame() {
  const rows = [
    { n: 4, sheet: "Test Kullanıcı", abon: "SiteX B3.31 · Aidat", per: "2026-01", t: 0, st: "danger", note: "Tutar boş — \"X\" iptal mı, manuel mi?", color: T.danger500, bg: T.danger100, label: "HATA" },
    { n: 7, sheet: "Mehmet Ali", abon: "Yeni: 'M.HÜRBAN 0532...'", per: "2026-01", t: 729.0, st: "purple", note: "Yeni kişi/kurum tespit. Manuel doğrula.", color: T.purple500, bg: T.purple100, label: "KONTROL" },
    { n: 4, sheet: "Ali Acme", abon: "SiteX A4.17 Aidat", per: "2026-01", t: 28344, st: "warning", note: "Tutar geçen aydan %0 değişti.", color: T.warning500, bg: T.warning100, label: "UYARI" },
    { n: 1, sheet: "M. Rahim Acme", abon: "Türk Telekom · Ev Tel.", per: "2026-01", t: 187.0, st: "ok", note: null, color: T.success500, bg: T.success100, label: "OK" },
    { n: 2, sheet: "M. Rahim Acme", abon: "TTNet · İnternet", per: "2026-01", t: 683.6, st: "ok", note: null, color: T.success500, bg: T.success100, label: "OK" },
    { n: 6, sheet: "Kaan Acme", abon: "SiteX B2.28 Giderler", per: "2026-01", t: 1830.38, st: "ok", note: null, color: T.success500, bg: T.success100, label: "OK" },
  ];

  return (
    <MobileFrame>
      <MobileTopBar title="Import Kontrol" sub="EV_ABONELIKLERI · 42 satır" back />

      {/* ÖZET KARTLAR */}
      <div style={{ padding: 16, background: "#fff", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {[
            ["OK", 34, T.success500, T.success100],
            ["Uyarı", 3, T.warning500, T.warning100],
            ["Hata", 3, T.danger500, T.danger100],
            ["Kontrol", 2, T.purple500, T.purple100],
          ].map(([l, n, c, b]) => (
            <div key={l} style={{ padding: 10, background: b, borderRadius: 8, textAlign: "center", borderLeft: `3px solid ${c}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: MMONO }}>{n}</div>
              <div style={{ fontSize: 9, color: T.ink2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* UYARI BANNER */}
      <div style={{ margin: "12px 16px 0", padding: 12, background: T.warning100, borderRadius: 10, border: `1px solid ${T.warning500}30`, fontSize: 12, color: T.warning500, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
        ⚠ Mapping düzenleme için <b>masaüstü</b> önerilir. Mobilde sadece onay/red yapılabilir.
      </div>

      {/* TABS */}
      <div style={{ padding: "12px 16px", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
        {[
          ["Özet", false],
          ["Satırlar", true, 42],
          ["Hatalar", false, 6],
          ["Belge", false],
        ].map(([l, a, c]) => (
          <div key={l} style={{ minHeight: 36, padding: "8px 14px", borderRadius: 9999, background: a ? T.brand700 : T.bg, color: a ? "#fff" : T.ink2, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            {l}{c && <span style={{ padding: "1px 6px", background: a ? "rgba(255,255,255,0.2)" : T.border, color: a ? "#fff" : T.ink2, borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>{c}</span>}
          </div>
        ))}
      </div>

      {/* SATIR KARTLARI */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 100px" }}>
        {rows.map((r, i) => (
          <Card key={i} pad={14} style={{ marginBottom: 10, borderLeft: `4px solid ${r.color}`, background: r.st === "ok" ? "#fff" : r.bg }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.brand700, fontFamily: MMONO }}>#{r.n}</span>
                <MStatusTag label={r.label} bg="#fff" fg={r.color} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: r.t === 0 ? T.muted : T.brand900, fontFamily: MMONO }}>{r.t === 0 ? "—" : MoneyM(r.t)}</div>
            </div>
            <div style={{ fontSize: 13, color: T.ink, fontWeight: 700, lineHeight: 1.4 }}>{r.sheet}</div>
            <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>{r.abon} · <span style={{ fontFamily: MMONO }}>{r.per}</span></div>
            {r.note && (
              <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 6, fontSize: 11, color: r.color, fontWeight: 600, lineHeight: 1.4 }}>
                {r.label === "HATA" ? "⛔" : r.label === "KONTROL" ? "🔎" : "⚠"} {r.note}
              </div>
            )}
            {r.st !== "ok" && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button style={{ flex: 1, minHeight: 44, background: T.success500, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>✓ Onayla</button>
                <button style={{ flex: 1, minHeight: 44, background: "#fff", color: T.brand700, border: `1px solid ${T.brand700}`, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>✏ Düzelt</button>
                <button style={{ width: 44, height: 44, background: "#fff", color: T.purple500, border: `1px solid ${T.purple500}`, borderRadius: 8, fontSize: 14 }}>🛡</button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* STICKY BOTTOM */}
      <div style={{ background: "#fff", borderTop: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", gap: 8, flexShrink: 0 }}>
        <button style={{ flex: 2, minHeight: 48, background: T.success500, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>✓ Sadece Yeşilleri (34)</button>
        <button style={{ flex: 1, minHeight: 48, background: "#fff", color: T.ink2, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>Taslak</button>
      </div>
    </MobileFrame>
  );
}

/* ============================================================
   FRAME 25 — Mobile Chat Fullscreen
   ============================================================ */
function MobileChatFrame() {
  return (
    <MobileFrame bg="#fff">
      {/* HEADER */}
      <div style={{ height: 56, background: "#fff", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 8px", gap: 6, flexShrink: 0 }}>
        <button style={{ width: 44, height: 44, border: "none", background: "transparent", color: T.brand700, fontSize: 22, cursor: "pointer" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.brand900 }}>Muhasebe Chat</div>
          <div style={{ fontSize: 11, color: T.success500, fontWeight: 600 }}>● 4 kişi çevrimiçi</div>
        </div>
        <button style={{ width: 44, height: 44, border: "none", background: "transparent", color: T.ink2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ico.search}</button>
        <button style={{ width: 44, height: 44, border: "none", background: "transparent", color: T.ink2, cursor: "pointer", fontSize: 18 }}>✏</button>
      </div>

      {/* THREAD LİSTESİ + AKTİF THREAD = 2 BÖLÜM (split visual) */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* Thread Listesi MİNİ */}
        <div style={{ background: T.bg, padding: "8px 12px", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Thread Listesi</div>
        {[
          ["SiteX / A4.17 / 2026-05 Ekstre", "Bakıyorum, aidat farkı 1.864 TL...", "2 dk", T.brand700, true, 0, true],
          ["Muhasebe Müdürü", "Toplantı 14:00'a alındı.", "1 sa", T.brand500, false, 2],
          ["Ayşe", "Albaraka talimatı aktif ✓", "3 sa", T.success500, false, 0],
          ["Erdal", "Dekontu akşama yüklerim", "5 sa", T.info500, false, 1],
          ["Teminat / 71-D8-3842", "Komisyon ödendi", "Dün", T.purple500, false, 0, true],
          ["Türk Telekom Mayıs", "Otomatik tahsil tamam", "Dün", T.warning500, false, 0, true],
          ["Melek", "BAĞKUR dekontları hazır", "Dün", T.danger500, false, 3],
        ].map(([n, son, z, c, sel, unread, link], i) => (
          <div key={i} style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 12, alignItems: "center", background: sel ? T.brand100 : "#fff", cursor: "pointer", minHeight: 44 }}>
            <div style={{ width: 40, height: 40, borderRadius: 9999, background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{link ? "📎" : n[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: sel || unread > 0 ? 700 : 600, color: T.brand900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</div>
                <div style={{ fontSize: 11, color: T.muted, flexShrink: 0, marginLeft: 6 }}>{z}</div>
              </div>
              <div style={{ fontSize: 12, color: T.ink2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{son}</div>
            </div>
            {unread > 0 && <div style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 9999, background: T.danger500, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{unread}</div>}
          </div>
        ))}
      </div>

      {/* AKTİF THREAD ALT YARI */}
      <div style={{ borderTop: `4px solid ${T.brand700}`, background: T.bg, flexShrink: 0, display: "flex", flexDirection: "column", maxHeight: 380 }}>
        {/* Thread Header + Context */}
        <div style={{ background: "#fff", padding: "10px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: T.brand100, color: T.brand700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📎</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.brand900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>SiteX / A4.17 / 2026-05</div>
            <div style={{ fontSize: 10, color: T.ink2, fontFamily: MMONO }}>Aidat ₺ 18.750,00 · 20.05</div>
          </div>
          <button style={{ minHeight: 36, padding: "0 10px", border: `1px solid ${T.brand700}`, color: T.brand700, background: "#fff", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>Kayda Git</button>
        </div>

        {/* Mesajlar */}
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {/* Sistem mesajı */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span style={{ display: "inline-block", padding: "4px 12px", background: T.success100, color: T.success500, borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>📎 Dekont yüklendi · 14:32</span>
          </div>
          {/* Diğer mesaj */}
          <div style={{ marginBottom: 10, display: "flex", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9999, background: T.brand500, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>A</div>
            <div style={{ maxWidth: "75%" }}>
              <div style={{ padding: "8px 12px", background: "#fff", color: T.ink, borderRadius: "12px 12px 12px 4px", fontSize: 14, border: `1px solid ${T.border}` }}>
                Ekstreyi yükledim, kontrol eder misin? Aidat farkı var.
              </div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 3, fontFamily: MMONO }}>Ayşe · 14:25</div>
            </div>
          </div>
          {/* Dosya kartı */}
          <div style={{ marginBottom: 10, display: "flex", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9999, background: T.brand500, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>A</div>
            <div style={{ maxWidth: "75%", padding: 8, background: "#fff", borderRadius: "12px 12px 12px 4px", border: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 36, height: 36, background: T.danger500, color: "#fff", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800 }}>PDF</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>A4.17_2026-05.pdf</div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: MMONO }}>248 KB</div>
                </div>
              </div>
            </div>
          </div>
          {/* Benim mesajım */}
          <div style={{ marginBottom: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <div style={{ maxWidth: "75%" }}>
              <div style={{ padding: "8px 12px", background: T.brand700, color: "#fff", borderRadius: "12px 12px 4px 12px", fontSize: 14 }}>
                Bakıyorum, aidat farkı 1.864 TL — mutabakat görevini açıyorum.
              </div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 3, fontFamily: MMONO, textAlign: "right" }}>Sen · 14:32 ✓✓</div>
            </div>
          </div>
        </div>

        {/* Input Bar */}
        <div style={{ background: "#fff", borderTop: `1px solid ${T.border}`, padding: 10, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button style={{ width: 44, height: 44, border: "none", background: "transparent", color: T.ink2, cursor: "pointer", fontSize: 20 }}>📎</button>
          <div style={{ flex: 1, minHeight: 44, padding: "12px 14px", background: T.bg, borderRadius: 22, fontSize: 16, color: T.muted }}>Mesaj... @</div>
          <button style={{ width: 44, height: 44, border: "none", background: T.brand700, color: "#fff", borderRadius: 9999, cursor: "pointer", fontSize: 16 }}>➤</button>
        </div>
      </div>
    </MobileFrame>
  );
}

/* ============================================================
   ROOT — DesignCanvas
   ============================================================ */
export default function App() {
  return (
    <DesignCanvas>
      <DCSection id="sprint-1a" title="MUHASEBE OPERASYON SİSTEMİ — Sprint 1A">
        <DCArtboard id="design-system" label="00 Design System" width={1440} height={1600}>
          <DesignSystemFrame />
        </DCArtboard>

        <DCArtboard id="app-shell" label="01 App Shell" width={1440} height={900}>
          <AppShellFrame />
        </DCArtboard>

        <DCArtboard id="dashboard" label="02 Dashboard" width={1440} height={1100}>
          <DashboardFrame />
        </DCArtboard>

        <DCArtboard id="import-center" label="03 Import Center" width={1440} height={1100}>
          <ImportCenterFrame />
        </DCArtboard>

        <DCArtboard id="import-preview" label="04 Import Preview" width={1440} height={950}>
          <ImportPreviewFrame />
        </DCArtboard>
      </DCSection>

      <DCSection id="sprint-1b" title="Sprint 1B — Fatura & Ödeme">
        <DCArtboard id="invoice-list" label="05 Fatura / Ödeme Listesi" width={1440} height={1200}>
          <InvoiceListFrame />
        </DCArtboard>

        <DCArtboard id="invoice-detail" label="06 Fatura / Ödeme Detay" width={1440} height={1200}>
          <InvoiceDetailFrame />
        </DCArtboard>

        <DCArtboard id="payment-mark-modal" label="07 Ödeme İşaretleme Modal" width={1440} height={900}>
          <PaymentMarkModalFrame />
        </DCArtboard>
      </DCSection>

      <DCSection id="sprint-1c" title="Sprint 1C — Abonelik, SiteX, Emlak">
        <DCArtboard id="subscription-list" label="08 Abonelik & Taahhüt Listesi" width={1440} height={1200}>
          <SubscriptionListFrame />
        </DCArtboard>

        <DCArtboard id="pruva34-dashboard" label="09 SiteX Daire / Aidat Dashboard" width={1440} height={1300}>
          <SiteXFrame />
        </DCArtboard>

        <DCArtboard id="emlak-grid" label="10 Emlak Vergisi / Mülk Takip" width={1440} height={1200}>
          <EmlakFrame />
        </DCArtboard>
      </DCSection>

      <DCSection id="sprint-1d" title="Sprint 1D — Teminat, Resmi Ödemeler, Düzenli Ödemeler">
        <DCArtboard id="teminat-list" label="11 Teminat Mektupları Takip" width={1440} height={1200}>
          <TeminatFrame />
        </DCArtboard>

        <DCArtboard id="resmi-odemeler" label="12 Resmi Ödemeler / BAĞKUR / SSK / İTO / BES" width={1440} height={1200}>
          <ResmiOdemelerFrame />
        </DCArtboard>

        <DCArtboard id="duzenli-odemeler" label="13 Düzenli Ödemeler / Kira / SMMM / Hizmetler" width={1440} height={1200}>
          <DuzenliOdemelerFrame />
        </DCArtboard>
      </DCSection>

      <DCSection id="sprint-1e" title="Sprint 1E — Entegratör, Ajanda, Bildirim">
        <DCArtboard id="entegrator" label="14 ETA / Papinet / Entegratör / Kontör" width={1440} height={1200}>
          <EntegratorFrame />
        </DCArtboard>

        <DCArtboard id="ajanda" label="15 Ajanda & Görev Yönetimi" width={1440} height={1250}>
          <AjandaFrame />
        </DCArtboard>

        <DCArtboard id="bildirim" label="16 Bildirim / Telegram Merkezi" width={1440} height={1200}>
          <BildirimFrame />
        </DCArtboard>
      </DCSection>

      <DCSection id="sprint-1f" title="Sprint 1F — Raporlama, AuditLog, Yetki, Master Tablolar">
        <DCArtboard id="raporlama" label="17 Raporlama / Excel Export Merkezi" width={1440} height={1200}>
          <RaporlamaFrame />
        </DCArtboard>

        <DCArtboard id="auditlog" label="18 AuditLog & İşlem Geçmişi" width={1440} height={1200}>
          <AuditLogFrame />
        </DCArtboard>

        <DCArtboard id="yetki-master" label="19 Yetki Yönetimi & Master Tablolar" width={1440} height={1300}>
          <YetkiMasterFrame />
        </DCArtboard>
      </DCSection>

      <DCSection id="sprint-1g" title="Sprint 1G — Mobil Varyantlar (iPhone Pro Max 430×932)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
          <DCArtboard id="m-dashboard" label="20 Mobile Dashboard" width={430} height={932}>
            <MobileDashboardFrame />
          </DCArtboard>

          <DCArtboard id="m-tasks" label="21 Mobile Bugünkü Görevler" width={430} height={932}>
            <MobileTasksFrame />
          </DCArtboard>

          <DCArtboard id="m-payment-list" label="22 Mobile Ödeme Listesi" width={430} height={932}>
            <MobilePaymentListFrame />
          </DCArtboard>

          <DCArtboard id="m-payment-detail" label="23 Mobile Ödeme Detay & Dekont" width={430} height={932}>
            <MobilePaymentDetailFrame />
          </DCArtboard>

          <DCArtboard id="m-import" label="24 Mobile Import Kontrol" width={430} height={932}>
            <MobileImportFrame />
          </DCArtboard>

          <DCArtboard id="m-chat" label="25 Mobile Chat Fullscreen" width={430} height={932}>
            <MobileChatFrame />
          </DCArtboard>
        </div>
      </DCSection>
    </DesignCanvas>
  );
}
