-- CreateEnum
CREATE TYPE "WorkAccess" AS ENUM ('public', 'preview', 'members');

-- AlterTable
ALTER TABLE "Work" ADD COLUMN     "access" "WorkAccess" NOT NULL DEFAULT 'public',
ADD COLUMN     "previewParts" INTEGER NOT NULL DEFAULT 10;
