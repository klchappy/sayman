-- Enable pgvector extension (Supabase has it preinstalled, no superuser needed in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- payable_embeddings: payable_items başına 1024-dim semantic vector
-- Voyage AI (voyage-3-lite) veya OpenAI text-embedding-3-small
CREATE TABLE IF NOT EXISTS payable_embeddings (
  payable_id uuid PRIMARY KEY REFERENCES payable_items(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  embedding vector(1024) NOT NULL,
  source_text text NOT NULL,
  model text NOT NULL DEFAULT 'voyage-3-lite',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payable_embeddings_tenant
  ON payable_embeddings(tenant_id);

-- IVFFlat index — cosine distance (cosine similarity = 1 - cosine_distance)
-- lists = sqrt(N), ~100 typical (yetersiz dataset için exact arama düşer).
CREATE INDEX IF NOT EXISTS idx_payable_embeddings_cosine
  ON payable_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
