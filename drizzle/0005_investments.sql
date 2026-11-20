CREATE TYPE "public"."asset_type" AS ENUM('saham', 'reksadana', 'emas', 'crypto', 'deposito', 'obligasi', 'lainnya');--> statement-breakpoint
CREATE TYPE "public"."investment_txn_type" AS ENUM('buy', 'sell', 'dividend');--> statement-breakpoint
CREATE TABLE "investment_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"ticker" text,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"unit_label" text DEFAULT 'unit' NOT NULL,
	"current_price" bigint,
	"price_updated_at" timestamp with time zone,
	"note" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investment_assets_price_nonneg" CHECK ("investment_assets"."current_price" is null or "investment_assets"."current_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "investment_txns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"type" "investment_txn_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"units" numeric(24, 8),
	"price" bigint,
	"fee" bigint DEFAULT 0 NOT NULL,
	"amount" bigint NOT NULL,
	"transaction_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investment_txns_amount_nonneg" CHECK ("investment_txns"."amount" >= 0),
	CONSTRAINT "investment_txns_fee_nonneg" CHECK ("investment_txns"."fee" >= 0),
	CONSTRAINT "investment_txns_shape" CHECK (("investment_txns"."type" = 'dividend' and "investment_txns"."units" is null and "investment_txns"."price" is null)
       or ("investment_txns"."type" <> 'dividend' and "investment_txns"."units" > 0 and "investment_txns"."price" >= 0))
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "system_key" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "exclude_from_stats" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_assets" ADD CONSTRAINT "investment_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_txns" ADD CONSTRAINT "investment_txns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_txns" ADD CONSTRAINT "investment_txns_asset_id_investment_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."investment_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_txns" ADD CONSTRAINT "investment_txns_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "investment_assets_user_name_uq" ON "investment_assets" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "investment_txns_asset_idx" ON "investment_txns" USING btree ("asset_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "investment_txns_transaction_uq" ON "investment_txns" USING btree ("transaction_id") WHERE "investment_txns"."transaction_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_system_key_uq" ON "categories" USING btree ("user_id","system_key") WHERE "categories"."system_key" is not null;--> statement-breakpoint
-- backfill penanda kategori sistem untuk user yang dibuat sebelum kolom system_key ada
UPDATE "categories" SET "system_key" = CASE
  WHEN "kind" = 'expense' AND "name" = 'Biaya Admin' THEN 'admin_fee'
  WHEN "kind" = 'expense' AND "name" = 'Pajak' THEN 'tax'
  WHEN "kind" = 'expense' AND "name" = 'Investasi' THEN 'investment'
  WHEN "kind" = 'income' AND "name" = 'Bunga' THEN 'interest'
  WHEN "kind" = 'income' AND "name" = 'Hasil Investasi' THEN 'investment_return'
END
WHERE "is_system" = true AND "system_key" IS NULL;
