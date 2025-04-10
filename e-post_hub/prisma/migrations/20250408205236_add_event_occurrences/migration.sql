/*
  Warnings:

  - You are about to drop the column `endDate` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `endDateTime` on the `EventOccurrence` table. All the data in the column will be lost.
  - You are about to drop the column `startDateTime` on the `EventOccurrence` table. All the data in the column will be lost.
  - Added the required column `date` to the `EventOccurrence` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "endDate",
DROP COLUMN "endTime",
DROP COLUMN "startDate",
DROP COLUMN "startTime";

-- AlterTable
ALTER TABLE "EventOccurrence" DROP COLUMN "endDateTime",
DROP COLUMN "startDateTime",
ADD COLUMN     "date" DATE NOT NULL,
ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "startTime" TEXT;
