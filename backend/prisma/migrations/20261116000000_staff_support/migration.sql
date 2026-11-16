-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('WAITING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportAuthor" AS ENUM ('CUSTOMER', 'GUARDEX', 'MANAGER');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MANAGER';

-- CreateTable
CREATE TABLE "support_cases" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "manager_id" TEXT,
    "status" "SupportStatus" NOT NULL DEFAULT 'WAITING',
    "summary" TEXT NOT NULL,
    "generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" SERIAL NOT NULL,
    "case_id" TEXT NOT NULL,
    "author" "SupportAuthor" NOT NULL,
    "body" TEXT NOT NULL,
    "client_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_notes" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "manager_id" TEXT,
    "message_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "generated" BOOLEAN NOT NULL DEFAULT false,
    "status" "NoteStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_cases_status_updated_at_idx" ON "support_cases"("status", "updated_at");

-- CreateIndex
CREATE INDEX "support_cases_customer_id_updated_at_idx" ON "support_cases"("customer_id", "updated_at");

-- CreateIndex
CREATE INDEX "support_cases_manager_id_updated_at_idx" ON "support_cases"("manager_id", "updated_at");

-- CreateIndex
CREATE INDEX "support_messages_case_id_id_idx" ON "support_messages"("case_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "support_messages_case_id_client_key_key" ON "support_messages"("case_id", "client_key");

-- CreateIndex
CREATE UNIQUE INDEX "client_notes_message_id_key" ON "client_notes"("message_id");

-- CreateIndex
CREATE INDEX "client_notes_customer_id_status_created_at_idx" ON "client_notes"("customer_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "support_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
