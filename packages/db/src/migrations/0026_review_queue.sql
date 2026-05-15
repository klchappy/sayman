-- Import sırasında otomatik yaratılan kayıtlar için review queue
ALTER TABLE companies ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_created_source text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_created_at timestamptz;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE persons ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS auto_created_source text;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS auto_created_at timestamptz;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- Review queue için index
CREATE INDEX IF NOT EXISTS idx_companies_review
  ON companies(organization_id, needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_persons_review
  ON persons(organization_id, needs_review) WHERE needs_review = true;
