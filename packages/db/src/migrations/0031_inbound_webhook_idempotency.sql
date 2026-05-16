-- Inbound webhook idempotency — caller tarafı X-Idempotency-Key header'ı
-- geçtiğinde duplicate delivery'leri DB'de yakalarız.
-- Aynı endpoint+key kombinasyonu ikinci kez gelirse uniqueIndex hata fırlatır,
-- route handler bunu yakalayıp önceki event'i geri döner.

ALTER TABLE inbound_webhook_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_inbound_idempotency
  ON inbound_webhook_events (endpoint_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
