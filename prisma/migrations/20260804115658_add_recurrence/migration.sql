-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurrenceGroupId" TEXT;
