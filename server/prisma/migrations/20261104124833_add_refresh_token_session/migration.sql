/*
  Warnings:

  - Added the required column `family_id` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `session_expired_at` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "family_id" UUID NOT NULL,
ADD COLUMN     "session_expired_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
