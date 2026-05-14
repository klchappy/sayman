CREATE TABLE "subsidiaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"parent_subsidiary_id" uuid,
	"color" text,
	"sort_order" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subsidiaries" ADD CONSTRAINT "subsidiaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_subsidiaries_tenant" ON "subsidiaries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_subsidiaries_parent" ON "subsidiaries" USING btree ("parent_subsidiary_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subsidiaries_tenant_code" ON "subsidiaries" USING btree ("tenant_id","code") WHERE code IS NOT NULL;