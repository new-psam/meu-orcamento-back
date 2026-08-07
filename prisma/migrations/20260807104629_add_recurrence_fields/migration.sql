-- CreateEnum
CREATE TYPE "TransactionPeriod" AS ENUM ('YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "recurrencePeriod" "TransactionPeriod";
