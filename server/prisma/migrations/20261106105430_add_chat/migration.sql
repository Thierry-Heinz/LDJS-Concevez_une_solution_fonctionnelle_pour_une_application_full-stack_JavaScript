/*
  Warnings:

  - You are about to drop the column `session_expired_at` on the `refresh_tokens` table. All the data in the column will be lost.
  - Added the required column `session_expires_at` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "conversationOrigin" AS ENUM ('GENERAL', 'AGENCY');

-- CreateEnum
CREATE TYPE "conversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "senderType" AS ENUM ('GUEST', 'CUSTOMER', 'AGENCY', 'CENTRAL');

-- AlterTable
ALTER TABLE "refresh_tokens" RENAME COLUMN "session_expired_at" TO "session_expires_at";

-- CreateTable
CREATE TABLE "Agency" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "guestId" UUID,
    "origin" "conversationOrigin" NOT NULL DEFAULT 'GENERAL',
    "agency_id" UUID,
    "bookingId" UUID,
    "status" "conversationStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "senderType" "senderType" NOT NULL,
    "sender_user_id" UUID,
    "sender_agency_id" UUID,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_conversation_id_sentAt_idx" ON "messages"("conversation_id", "sentAt");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_agency_id_fkey" FOREIGN KEY ("sender_agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
