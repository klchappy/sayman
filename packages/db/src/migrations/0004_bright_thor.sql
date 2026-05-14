-- ============================================================================
-- Migration 0004 — Kullanıcı yönetimi
--   1. user_invitations tablosu (davet token + expires_at)
--   2. role + tenant_override_value PG enum'larını yeni 7-rollü set ile değiştir
--      Eski → Yeni mapping:
--        muhasebe_muduru → organization_admin
--        goruntuleyici  → denetci
-- ============================================================================

-- 1) user_invitations tablosu
CREATE TABLE "user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"tenant_id" uuid,
	"invited_by" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_auth_accounts_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."auth_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_invitations_org_email_pending" ON "user_invitations" USING btree ("organization_id","email") WHERE accepted_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_user_invitations_token" ON "user_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_user_invitations_org" ON "user_invitations" USING btree ("organization_id");--> statement-breakpoint

-- 2) Role enum migration (eski → yeni mapping + yeni isimler)
-- Default constraint'i geçici olarak kaldır (eski enum'a bağlı)
ALTER TABLE "user_organization_roles" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_organization_roles" ALTER COLUMN "role" TYPE text USING "role"::text;--> statement-breakpoint
ALTER TABLE "user_tenant_overrides" ALTER COLUMN "value" TYPE text USING "value"::text;--> statement-breakpoint

-- Eski değerleri yeni isimlere map et
UPDATE "user_organization_roles" SET "role" = 'organization_admin' WHERE "role" = 'muhasebe_muduru';--> statement-breakpoint
UPDATE "user_organization_roles" SET "role" = 'denetci' WHERE "role" = 'goruntuleyici';--> statement-breakpoint
UPDATE "user_tenant_overrides" SET "value" = 'organization_admin' WHERE "value" = 'muhasebe_muduru';--> statement-breakpoint
UPDATE "user_tenant_overrides" SET "value" = 'denetci' WHERE "value" = 'goruntuleyici';--> statement-breakpoint

-- Eski enum tiplerini drop et
DROP TYPE "role";--> statement-breakpoint
DROP TYPE "tenant_override_value";--> statement-breakpoint

-- Yeni enum tiplerini yarat
CREATE TYPE "role" AS ENUM ('super_admin','organization_admin','yonetici','muhasebeci','denetci','personel','musavir');--> statement-breakpoint
CREATE TYPE "tenant_override_value" AS ENUM ('super_admin','organization_admin','yonetici','muhasebeci','denetci','personel','musavir','deny');--> statement-breakpoint

-- Column'ları yeni enum'a cast et
ALTER TABLE "user_organization_roles" ALTER COLUMN "role" TYPE "role" USING "role"::"role";--> statement-breakpoint
ALTER TABLE "user_organization_roles" ALTER COLUMN "role" SET DEFAULT 'muhasebeci'::"role";--> statement-breakpoint
ALTER TABLE "user_tenant_overrides" ALTER COLUMN "value" TYPE "tenant_override_value" USING "value"::"tenant_override_value";
