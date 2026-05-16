-- Voyage AI → OpenAI embeddings geçişi.
-- Eski Voyage vektörleri (voyage-3-lite, 1024d) farklı vector space'te,
-- yeni OpenAI vektörleriyle (text-embedding-3-small, dim=1024) karşılaştırılamaz.
-- Temizliyoruz — embed-payables cron yeniden doldurur.

DELETE FROM payable_embeddings WHERE model LIKE 'voyage%';

-- Default model adını güncelle (yeni kayıtlar için)
ALTER TABLE payable_embeddings
  ALTER COLUMN model SET DEFAULT 'text-embedding-3-small';
