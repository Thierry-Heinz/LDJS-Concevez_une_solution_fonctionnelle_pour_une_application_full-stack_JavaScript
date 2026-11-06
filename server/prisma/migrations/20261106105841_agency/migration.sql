/*
  Warnings:

  - You are about to drop the `Agency` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_agency_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_agency_id_fkey";

-- DropTable
DROP TABLE "Agency";

-- CreateTable
CREATE TABLE "agency" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "agency_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_agency_id_fkey" FOREIGN KEY ("sender_agency_id") REFERENCES "agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
