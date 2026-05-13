CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'archive', 'restore', 'login', 'logout', 'import', 'export', 'permission_change');--> statement-breakpoint
CREATE TYPE "public"."owner_type" AS ENUM('company', 'person', 'family', 'other');--> statement-breakpoint
CREATE TYPE "public"."payable_status" AS ENUM('draft', 'pending', 'approaching', 'overdue', 'partial_paid', 'paid', 'cancelled', 'archived', 'needs_review', 'waiting_approval');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('auto', 'eft', 'havale', 'credit_card', 'cash', 'elden', 'other');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('trial', 'basic', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super_admin', 'yonetici', 'muhasebe_muduru', 'muhasebeci', 'personel', 'goruntuleyici');--> statement-breakpoint
CREATE TYPE "public"."sector" AS ENUM('tekstil', 'enerji', 'insaat', 'gayrimenkul', 'kisisel', 'sanayi', 'hukuk', 'diger');--> statement-breakpoint
CREATE TYPE "public"."tenant_override_value" AS ENUM('super_admin', 'yonetici', 'muhasebe_muduru', 'muhasebeci', 'personel', 'goruntuleyici', 'deny');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" "plan" DEFAULT 'trial' NOT NULL,
	"contact_email" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sector" "sector" DEFAULT 'diger' NOT NULL,
	"active_modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_organization_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "role" DEFAULT 'muhasebeci' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tenant_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"value" "tenant_override_value" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"email" text NOT NULL,
	"username" text,
	"full_name" text NOT NULL,
	"avatar_url" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"tax_number" text,
	"registry_number" text,
	"share_scope" jsonb DEFAULT '"*"'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"institution_type" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"national_id" text,
	"phone" text,
	"family_group" text,
	"share_scope" jsonb DEFAULT '"*"'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"property_type" text,
	"owner_person_id" uuid,
	"owner_company_id" uuid,
	"municipality" text,
	"registry_number" text,
	"site_unit_code" text,
	"share_scope" jsonb DEFAULT '"*"'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payable_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_type" "owner_type" DEFAULT 'company' NOT NULL,
	"company_id" uuid,
	"person_id" uuid,
	"title" text NOT NULL,
	"category" text,
	"institution_id" uuid,
	"supplier_name" text,
	"invoice_number" text,
	"subscription_reference" text,
	"period_label" text,
	"issue_date" date,
	"due_date" date,
	"auto_payment_date" date,
	"amount" numeric(15, 2) NOT NULL,
	"paid_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"status" "payable_status" DEFAULT 'pending' NOT NULL,
	"expected_method" "payment_method",
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payable_id" uuid NOT NULL,
	"paid_at" date NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"bank_short_code" text,
	"receipt_url" text,
	"reference_no" text,
	"status" "transaction_status" DEFAULT 'approved' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"tenant_id" uuid,
	"actor_id" uuid,
	"action" "audit_action" NOT NULL,
	"module" text NOT NULL,
	"target_table" text,
	"target_id" uuid,
	"before_data" jsonb,
	"after_data" jsonb,
	"ip_address" text,
	"user_agent" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_roles" ADD CONSTRAINT "user_organization_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_roles" ADD CONSTRAINT "user_organization_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tenant_overrides" ADD CONSTRAINT "user_tenant_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tenant_overrides" ADD CONSTRAINT "user_tenant_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banks" ADD CONSTRAINT "banks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_person_id_persons_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_company_id_companies_id_fk" FOREIGN KEY ("owner_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_items" ADD CONSTRAINT "payable_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_items" ADD CONSTRAINT "payable_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_items" ADD CONSTRAINT "payable_items_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_items" ADD CONSTRAINT "payable_items_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_items" ADD CONSTRAINT "payable_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payable_id_payable_items_id_fk" FOREIGN KEY ("payable_id") REFERENCES "public"."payable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tenants_org" ON "tenants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_tenants_sector" ON "tenants" USING btree ("sector");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_tenants_org_slug" ON "tenants" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_user_org_roles_user" ON "user_organization_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_org_roles_org" ON "user_organization_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_org_roles" ON "user_organization_roles" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "idx_user_tenant_overrides_user" ON "user_tenant_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_tenant_overrides_tenant" ON "user_tenant_overrides" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_tenant_overrides" ON "user_tenant_overrides" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "idx_users_auth" ON "users" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_banks_org" ON "banks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_companies_org" ON "companies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_institutions_org" ON "institutions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_persons_org" ON "persons" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_properties_org" ON "properties" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_payable_tenant" ON "payable_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_payable_status" ON "payable_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payable_due" ON "payable_items" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_payable_period" ON "payable_items" USING btree ("tenant_id","period_label");--> statement-breakpoint
CREATE INDEX "idx_payment_tenant" ON "payment_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_payment_payable" ON "payment_transactions" USING btree ("payable_id");--> statement-breakpoint
CREATE INDEX "idx_audit_org" ON "audit_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_audit_tenant" ON "audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_actor" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_log" USING btree ("created_at");