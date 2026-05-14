CREATE TYPE "public"."subscription_status" AS ENUM('active', 'on_hold', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."regular_payment_kind" AS ENUM('rent', 'maintenance', 'subscription', 'lease', 'other');--> statement-breakpoint
CREATE TYPE "public"."official_payment_type" AS ENUM('BAGKUR', 'SSK', 'BES', 'ITO', 'KGK', 'GELIR', 'KDV', 'MTV', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_frequency" AS ENUM('monthly', 'quarterly', 'yearly', 'semiannual', 'occasional');--> statement-breakpoint
CREATE TYPE "public"."guarantee_status" AS ENUM('active', 'returned', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"institution_id" uuid,
	"owner_type" "owner_type" DEFAULT 'company' NOT NULL,
	"company_id" uuid,
	"person_id" uuid,
	"property_id" uuid,
	"subscription_no" text,
	"package_name" text,
	"auto_payment" boolean DEFAULT false NOT NULL,
	"monthly_amount" numeric(15, 2),
	"currency" text DEFAULT 'TRY' NOT NULL,
	"start_date" date,
	"end_date" date,
	"commitment_end_date" date,
	"cancellation_penalty" numeric(15, 2),
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regular_payment_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"period_label" text NOT NULL,
	"due_date" date,
	"amount" numeric(15, 2) NOT NULL,
	"status" "payable_status" DEFAULT 'pending' NOT NULL,
	"payable_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regular_payment_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "regular_payment_kind" DEFAULT 'rent' NOT NULL,
	"title" text NOT NULL,
	"landlord_owner_type" "owner_type",
	"landlord_company_id" uuid,
	"landlord_person_id" uuid,
	"payer_owner_type" "owner_type",
	"payer_company_id" uuid,
	"payer_person_id" uuid,
	"property_id" uuid,
	"start_date" date,
	"end_date" date,
	"monthly_amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"payment_day" integer DEFAULT 1 NOT NULL,
	"annual_increase_rate" numeric(5, 2),
	"next_increase_date" date,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_payment_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"period_label" text NOT NULL,
	"due_date" date,
	"amount" numeric(15, 2) NOT NULL,
	"status" "payable_status" DEFAULT 'pending' NOT NULL,
	"payable_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_payment_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payment_type" "official_payment_type" NOT NULL,
	"frequency" "payment_frequency" DEFAULT 'monthly' NOT NULL,
	"owner_type" "owner_type" NOT NULL,
	"company_id" uuid,
	"person_id" uuid,
	"typical_amount" numeric(15, 2),
	"currency" text DEFAULT 'TRY' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guarantee_commission_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"guarantee_id" uuid NOT NULL,
	"period_label" text NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"status" "payable_status" DEFAULT 'pending' NOT NULL,
	"payable_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guarantees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid,
	"issuer_company_id" uuid,
	"beneficiary_name" text NOT NULL,
	"letter_no" text,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"issue_date" date,
	"expiry_date" date,
	"returned_at" date,
	"commission_rate" numeric(5, 2),
	"commission_frequency_months" integer DEFAULT 3 NOT NULL,
	"status" "guarantee_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_payment_periods" ADD CONSTRAINT "regular_payment_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_payment_periods" ADD CONSTRAINT "regular_payment_periods_profile_id_regular_payment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."regular_payment_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_payment_periods" ADD CONSTRAINT "regular_payment_periods_payable_id_payable_items_id_fk" FOREIGN KEY ("payable_id") REFERENCES "public"."payable_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_payment_profiles" ADD CONSTRAINT "regular_payment_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_payment_profiles" ADD CONSTRAINT "regular_payment_profiles_landlord_company_id_companies_id_fk" FOREIGN KEY ("landlord_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_payment_profiles" ADD CONSTRAINT "regular_payment_profiles_landlord_person_id_persons_id_fk" FOREIGN KEY ("landlord_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_payment_profiles" ADD CONSTRAINT "regular_payment_profiles_payer_company_id_companies_id_fk" FOREIGN KEY ("payer_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_payment_profiles" ADD CONSTRAINT "regular_payment_profiles_payer_person_id_persons_id_fk" FOREIGN KEY ("payer_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_payment_profiles" ADD CONSTRAINT "regular_payment_profiles_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_payment_periods" ADD CONSTRAINT "official_payment_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_payment_periods" ADD CONSTRAINT "official_payment_periods_profile_id_official_payment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."official_payment_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_payment_periods" ADD CONSTRAINT "official_payment_periods_payable_id_payable_items_id_fk" FOREIGN KEY ("payable_id") REFERENCES "public"."payable_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_payment_profiles" ADD CONSTRAINT "official_payment_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_payment_profiles" ADD CONSTRAINT "official_payment_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_payment_profiles" ADD CONSTRAINT "official_payment_profiles_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantee_commission_periods" ADD CONSTRAINT "guarantee_commission_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantee_commission_periods" ADD CONSTRAINT "guarantee_commission_periods_guarantee_id_guarantees_id_fk" FOREIGN KEY ("guarantee_id") REFERENCES "public"."guarantees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantee_commission_periods" ADD CONSTRAINT "guarantee_commission_periods_payable_id_payable_items_id_fk" FOREIGN KEY ("payable_id") REFERENCES "public"."payable_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantees" ADD CONSTRAINT "guarantees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantees" ADD CONSTRAINT "guarantees_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantees" ADD CONSTRAINT "guarantees_issuer_company_id_companies_id_fk" FOREIGN KEY ("issuer_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_subscriptions_tenant" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_commitment" ON "subscriptions" USING btree ("commitment_end_date");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_status" ON "subscriptions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_rpperiod_profile" ON "regular_payment_periods" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_rpperiod_period" ON "regular_payment_periods" USING btree ("tenant_id","period_label");--> statement-breakpoint
CREATE INDEX "idx_rpp_tenant" ON "regular_payment_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_rpp_kind" ON "regular_payment_profiles" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE INDEX "idx_opperiod_profile" ON "official_payment_periods" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_opperiod_period" ON "official_payment_periods" USING btree ("tenant_id","period_label");--> statement-breakpoint
CREATE INDEX "idx_opp_tenant" ON "official_payment_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_opp_type" ON "official_payment_profiles" USING btree ("tenant_id","payment_type");--> statement-breakpoint
CREATE INDEX "idx_gcperiod_guarantee" ON "guarantee_commission_periods" USING btree ("guarantee_id");--> statement-breakpoint
CREATE INDEX "idx_gcperiod_due" ON "guarantee_commission_periods" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_guarantees_tenant" ON "guarantees" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_guarantees_expiry" ON "guarantees" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_guarantees_status" ON "guarantees" USING btree ("tenant_id","status");