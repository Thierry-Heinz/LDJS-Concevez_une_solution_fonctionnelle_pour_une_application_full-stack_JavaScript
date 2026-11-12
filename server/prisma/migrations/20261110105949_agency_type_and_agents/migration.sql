/*
  Warnings:

  - The values [ADVISOR] on the enum `role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `bookingId` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `guestId` on the `conversations` table. All the data in the column will be lost.
  - The `origin` column on the `conversations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `conversations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `senderType` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `sentAt` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the `agency` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `agency_id` on table `conversations` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `sender_type` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "conversation_origin" AS ENUM ('GENERAL', 'AGENCY');

-- CreateEnum
CREATE TYPE "conversation_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "sender_type" AS ENUM ('GUEST', 'CUSTOMER', 'AGENT');

-- CreateEnum
CREATE TYPE "agency_type" AS ENUM ('CENTRAL', 'BRANCH');

-- AlterEnum
BEGIN;
CREATE TYPE "role_new" AS ENUM ('CUSTOMER', 'AGENT');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "role_new" USING ("role"::text::"role_new");
ALTER TYPE "role" RENAME TO "role_old";
ALTER TYPE "role_new" RENAME TO "role";
DROP TYPE "public"."role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_agency_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_agency_id_fkey";

-- DropIndex
DROP INDEX "messages_conversation_id_sentAt_idx";

-- AlterTable
ALTER TABLE "conversations" DROP COLUMN "bookingId",
DROP COLUMN "guestId",
ADD COLUMN     "booking_id" UUID,
ADD COLUMN     "guest_id" UUID,
DROP COLUMN "origin",
ADD COLUMN     "origin" "conversation_origin" NOT NULL DEFAULT 'GENERAL',
ALTER COLUMN "agency_id" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "conversation_status" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "senderType",
DROP COLUMN "sentAt",
ADD COLUMN     "sender_type" "sender_type" NOT NULL,
ADD COLUMN     "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "agency_id" UUID;

-- DropTable
DROP TABLE "agency";

-- DropEnum
DROP TYPE "conversationOrigin";

-- DropEnum
DROP TYPE "conversationStatus";

-- DropEnum
DROP TYPE "senderType";

-- CreateTable
CREATE TABLE "agencies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "agency_type" "agency_type" NOT NULL DEFAULT 'BRANCH',

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_conversation_id_sent_at_idx" ON "messages"("conversation_id", "sent_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_agency_id_fkey" FOREIGN KEY ("sender_agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
