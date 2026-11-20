CREATE TYPE "public"."transaction_source" AS ENUM('manual', 'import');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"wallet_id" uuid NOT NULL,
	"to_wallet_id" uuid,
	"category_id" uuid,
	"amount" bigint NOT NULL,
	"to_amount" bigint,
	"fee" bigint DEFAULT 0 NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"note" text,
	"counterparty" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" "transaction_source" DEFAULT 'manual' NOT NULL,
	"import_batch_id" uuid,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."amount" > 0),
	CONSTRAINT "transactions_fee_nonneg" CHECK ("transactions"."fee" >= 0),
	CONSTRAINT "transactions_to_amount_positive" CHECK ("transactions"."to_amount" is null or "transactions"."to_amount" > 0),
	CONSTRAINT "transactions_shape" CHECK (("transactions"."type" = 'transfer' and "transactions"."to_wallet_id" is not null and "transactions"."to_wallet_id" <> "transactions"."wallet_id" and "transactions"."category_id" is null)
       or ("transactions"."type" <> 'transfer' and "transactions"."to_wallet_id" is null and "transactions"."to_amount" is null))
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_wallet_id_wallets_id_fk" FOREIGN KEY ("to_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_user_occurred_idx" ON "transactions" USING btree ("user_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_wallet_idx" ON "transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "transactions_to_wallet_idx" ON "transactions" USING btree ("to_wallet_id");--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_user_external_uq" ON "transactions" USING btree ("user_id","external_id") WHERE "transactions"."external_id" is not null;