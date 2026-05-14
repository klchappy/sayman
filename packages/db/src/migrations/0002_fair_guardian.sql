CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('new', 'in_progress', 'waiting', 'postponed', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('payable_due', 'task_assigned', 'task_due', 'system', 'security', 'audit');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"status" "task_status" DEFAULT 'new' NOT NULL,
	"related_table" text,
	"related_id" uuid,
	"assigned_to" uuid,
	"created_by" uuid,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"postponed_until" timestamp with time zone,
	"postpone_reason" text,
	"auto_generated" boolean DEFAULT false NOT NULL,
	"template_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"title" text NOT NULL,
	"body" text,
	"category" "notification_category" DEFAULT 'system' NOT NULL,
	"priority" "notification_priority" DEFAULT 'info' NOT NULL,
	"related_table" text,
	"related_id" uuid,
	"action_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"telegram_mode" text,
	"telegram_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tasks_tenant" ON "tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_tasks_assigned" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_tasks_due" ON "tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_tasks_related" ON "tasks" USING btree ("related_table","related_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_tenant" ON "notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_related" ON "notifications" USING btree ("related_table","related_id");