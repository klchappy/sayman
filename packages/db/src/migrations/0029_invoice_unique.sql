-- Aynı tenant içinde aynı invoice_number iki kez kaydedilemez.
-- Smart-import / e-Fatura UBL / inbound webhook akışlarındaki race window'unu
-- DB seviyesinde kapatır. is_active=true filter'ı: arşivlenmiş/silinmiş kayıtlar
-- yeni bir kayıt için bloklamasın.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payable_invoice
  ON payable_items (tenant_id, invoice_number)
  WHERE is_active = true AND invoice_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sales_invoice
  ON sales_invoices (tenant_id, invoice_number)
  WHERE is_active = true AND invoice_number IS NOT NULL;
