-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('release', 'comment', 'follow', 'moderation');

-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('part', 'comment', 'user');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam', 'harassment', 'copyright', 'illegal', 'child_safety', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'upheld', 'rejected');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "analyticsOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailOnRelease" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pushOnRelease" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "strikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suspendedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Work" ADD COLUMN     "searchVector" tsvector;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "target" "ReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Report_status_urgent_createdAt_idx" ON "Report"("status", "urgent", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_target_targetId_key" ON "Report"("reporterId", "target", "targetId");

-- CreateIndex
CREATE INDEX "Work_searchVector_idx" ON "Work" USING GIN ("searchVector");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text search vector for works (doc 14 §7): title, synopsis, tags and
-- the writer's handle, `simple` dictionary. Maintained by trigger; backfilled.
CREATE OR REPLACE FUNCTION work_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce((SELECT handle FROM "User" WHERE id = NEW."ownerId"), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.synopsis, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS work_search_vector_trg ON "Work";
CREATE TRIGGER work_search_vector_trg
  BEFORE INSERT OR UPDATE OF title, synopsis, tags, "ownerId" ON "Work"
  FOR EACH ROW EXECUTE FUNCTION work_search_vector_update();

UPDATE "Work" SET title = title;
