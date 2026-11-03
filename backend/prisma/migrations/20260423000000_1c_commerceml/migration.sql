-- Интеграция с 1С по CommerceML: поля externalId, учётки и сессии обмена

-- Products: externalId (GUID из 1С), sku (артикул), stock (остаток), updatedAt
ALTER TABLE "products"
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "products_external_id_key" ON "products"("external_id");
CREATE INDEX "products_external_id_idx" ON "products"("external_id");

-- Orders: externalId, syncedAt
ALTER TABLE "orders"
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "synced_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "orders_external_id_key" ON "orders"("external_id");
CREATE INDEX "orders_synced_at_idx" ON "orders"("synced_at");

-- Учётка 1С для Basic Auth
CREATE TABLE "onec_users" (
  "id" TEXT NOT NULL,
  "login" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3),
  CONSTRAINT "onec_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "onec_users_login_key" ON "onec_users"("login");

-- Сессия обмена
CREATE TABLE "onec_sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "cookie" TEXT NOT NULL,
  "temp_dir" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onec_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "onec_sessions_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "onec_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "onec_sessions_cookie_key" ON "onec_sessions"("cookie");
CREATE INDEX "onec_sessions_expires_at_idx" ON "onec_sessions"("expires_at");
