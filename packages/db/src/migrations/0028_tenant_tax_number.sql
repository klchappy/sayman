-- e-Fatura recipient tax_number'dan tenant otomatik tespiti için
-- tenant'ların kendi VKN'lerini saklayalım. Eşleşme yoksa needs_review=true.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_number text;

CREATE INDEX IF NOT EXISTS idx_tenants_tax_number
  ON tenants(organization_id, tax_number)
  WHERE tax_number IS NOT NULL;
