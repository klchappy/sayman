ALTER TABLE "payable_items" ADD COLUMN "subsidiary_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "subsidiary_id" uuid;--> statement-breakpoint
ALTER TABLE "regular_payment_profiles" ADD COLUMN "subsidiary_id" uuid;--> statement-breakpoint
ALTER TABLE "official_payment_profiles" ADD COLUMN "subsidiary_id" uuid;--> statement-breakpoint
ALTER TABLE "guarantees" ADD COLUMN "subsidiary_id" uuid;--> statement-breakpoint
ALTER TABLE "payable_items" ADD CONSTRAINT "payable_items_subsidiary_id_subsidiaries_id_fk" FOREIGN KEY ("subsidiary_id") REFERENCES "public"."subsidiaries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subsidiary_id_subsidiaries_id_fk" FOREIGN KEY ("subsidiary_id") REFERENCES "public"."subsidiaries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_payment_profiles" ADD CONSTRAINT "regular_payment_profiles_subsidiary_id_subsidiaries_id_fk" FOREIGN KEY ("subsidiary_id") REFERENCES "public"."subsidiaries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_payment_profiles" ADD CONSTRAINT "official_payment_profiles_subsidiary_id_subsidiaries_id_fk" FOREIGN KEY ("subsidiary_id") REFERENCES "public"."subsidiaries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantees" ADD CONSTRAINT "guarantees_subsidiary_id_subsidiaries_id_fk" FOREIGN KEY ("subsidiary_id") REFERENCES "public"."subsidiaries"("id") ON DELETE set null ON UPDATE no action;