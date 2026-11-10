-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "workId" TEXT,
ALTER COLUMN "partId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "WorkLike" (
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkLike_pkey" PRIMARY KEY ("userId","workId")
);

-- CreateTable
CREATE TABLE "Rating" (
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("userId","workId")
);

-- CreateIndex
CREATE INDEX "WorkLike_workId_idx" ON "WorkLike"("workId");

-- CreateIndex
CREATE INDEX "Rating_workId_idx" ON "Rating"("workId");

-- CreateIndex
CREATE INDEX "Comment_workId_createdAt_idx" ON "Comment"("workId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLike" ADD CONSTRAINT "WorkLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLike" ADD CONSTRAINT "WorkLike_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
