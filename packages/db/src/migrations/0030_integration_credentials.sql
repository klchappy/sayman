-- Org-level default + tenant-level override credentials storage.
-- Lookup order (her servis çağrısında):
--   1) tenant_id = current → bu tenant için özel ayar varsa kullan
--   2) tenant_id IS NULL + organization_id = current → org default'unu kullan
--   3) Hiçbiri yoksa → process.env fallback (geriye dönük)

CREATE TABLE IF NOT EXISTS integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  /** NULL: org-level default — tüm tenant'lar otomatik bunu kullanır */
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  /** Servis anahtarı (örn: 'claude', 'voyage', 'resend', 'telegram', 'whatsapp') */
  integration_key text NOT NULL,
  /** JSONB credential map (örn: { "api_key": "sk-..." }) — AES-GCM şifrelenmiş tutulur */
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  /** Görsel metadata (e.g. model adı, son test sonucu) */
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Bir org içinde aynı (tenant_id, integration_key) tek olur
  -- tenant_id NULL ise her org+key için tek org-level row
  CONSTRAINT uniq_int_cred_tenant UNIQUE (organization_id, tenant_id, integration_key)
);

-- Org-level (tenant_id NULL) için ayrı partial unique (NULL'lar UNIQUE'te eşit sayılmaz Postgres'te)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_int_cred_org_default
  ON integration_credentials (organization_id, integration_key)
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_int_cred_lookup
  ON integration_credentials (organization_id, tenant_id, integration_key)
  WHERE is_active = true;
