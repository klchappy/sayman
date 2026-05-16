-- Support tickets — kullanıcı sorunları + otomatik hata kayıtları.
--
-- Akış:
--   1. Frontend ErrorBoundary crash'inde otomatik POST → auto_error kategori
--   2. Backend errorHandler 500 hatasında otomatik POST → auto_error kategori
--   3. Kullanıcı /destek sayfasından manuel açar → bug/feature/question
--   4. Admin yanıtlar (status değişir, internal notes ekler)
--
-- error_context jsonb: { url, stack, user_agent, http_status, request_id, route_path }
-- internal_notes: sadece super_admin / organization_admin görür

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,

  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'question',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',

  error_context jsonb,
  internal_notes text,

  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status, priority, created_at DESC);
