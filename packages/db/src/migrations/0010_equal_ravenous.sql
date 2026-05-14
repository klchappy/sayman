CREATE TABLE "fx_rates" (
	"currency" text NOT NULL,
	"fx_date" date NOT NULL,
	"rate_try" numeric(15, 6) NOT NULL,
	"forex_buying" numeric(15, 6),
	"forex_selling" numeric(15, 6),
	"source" text DEFAULT 'tcmb' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fx_rates_date_currency" ON "fx_rates" USING btree ("fx_date","currency");--> statement-breakpoint
CREATE INDEX "idx_fx_rates_currency" ON "fx_rates" USING btree ("currency","fx_date");