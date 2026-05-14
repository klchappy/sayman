CREATE TABLE "category_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payable_id" uuid,
	"suggested_category" text,
	"actual_category" text NOT NULL,
	"source_text" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"summary_date" date NOT NULL,
	"kind" text DEFAULT 'daily' NOT NULL,
	"summary_text" text NOT NULL,
	"source_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"duration_ms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tenant_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"secret" text NOT NULL,
	"event_type" text DEFAULT 'payable_create' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_called_at" timestamp with time zone,
	"call_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"created_record_id" uuid,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "category_feedback" ADD CONSTRAINT "category_feedback_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_feedback" ADD CONSTRAINT "category_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_webhook_endpoints" ADD CONSTRAINT "inbound_webhook_endpoints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_webhook_endpoints" ADD CONSTRAINT "inbound_webhook_endpoints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" ADD CONSTRAINT "inbound_webhook_events_endpoint_id_inbound_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."inbound_webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_category_feedback_tenant" ON "category_feedback" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_category_feedback_actual" ON "category_feedback" USING btree ("actual_category");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_summaries_tenant_date_kind" ON "ai_summaries" USING btree ("tenant_id","summary_date","kind");--> statement-breakpoint
CREATE INDEX "idx_ai_summaries_tenant" ON "ai_summaries" USING btree ("tenant_id","summary_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inbound_slug" ON "inbound_webhook_endpoints" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_inbound_org" ON "inbound_webhook_endpoints" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inbound_events_endpoint" ON "inbound_webhook_events" USING btree ("endpoint_id","received_at");