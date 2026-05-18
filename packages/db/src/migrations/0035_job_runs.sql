-- job_runs — Cron job çalıştırmalarının persistent log'u (audit item #8)
-- Önceden cron job hataları sadece uçucu server log'a yazılıyordu; admin
-- panele bakmadan görünmüyordu.

CREATE TABLE IF NOT EXISTS "job_runs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "job_name" text NOT NULL,
    "status" text DEFAULT 'running' NOT NULL,
    "started_at" timestamptz DEFAULT now() NOT NULL,
    "finished_at" timestamptz,
    "duration_ms" text,
    "result" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "error_message" text,
    "hostname" text,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_job_runs_name" ON "job_runs" ("job_name");
CREATE INDEX IF NOT EXISTS "idx_job_runs_started" ON "job_runs" ("started_at");
CREATE INDEX IF NOT EXISTS "idx_job_runs_status" ON "job_runs" ("status");
