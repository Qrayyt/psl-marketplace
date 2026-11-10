ALTER TABLE "orders"
  ADD COLUMN "contact_name" TEXT,
  ADD COLUMN "contact_phone" TEXT,
  ADD COLUMN "contact_email" TEXT,
  ADD COLUMN "company" TEXT,
  ADD COLUMN "customer_note" TEXT,
  ADD COLUMN "request_id" TEXT;

CREATE UNIQUE INDEX "orders_user_id_request_id_key" ON "orders"("user_id", "request_id");

ALTER TABLE "product_documents"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "superseded_by_id" TEXT;
