-- Work kinds: poem | poem_collection | book | book_collection (was single | series).
-- Existing works become books, or poems when every part they have is a poem.
ALTER TYPE "WorkKind" RENAME TO "WorkKind_old";
CREATE TYPE "WorkKind" AS ENUM ('poem', 'poem_collection', 'book', 'book_collection');
ALTER TABLE "Work" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Work" ALTER COLUMN "kind" TYPE "WorkKind" USING ('book'::"WorkKind");
ALTER TABLE "Work" ALTER COLUMN "kind" SET DEFAULT 'book';
DROP TYPE "WorkKind_old";

UPDATE "Work" w
SET "kind" = CASE WHEN (SELECT count(*) FROM "Part" p WHERE p."workId" = w."id") = 1
                  THEN 'poem'::"WorkKind" ELSE 'poem_collection'::"WorkKind" END
WHERE EXISTS (SELECT 1 FROM "Part" p WHERE p."workId" = w."id")
  AND NOT EXISTS (SELECT 1 FROM "Part" p WHERE p."workId" = w."id" AND p."kind" <> 'poem');

ALTER TABLE "Work" ADD COLUMN "volumes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Part" ADD COLUMN "volume" INTEGER NOT NULL DEFAULT 1,
                   ADD COLUMN "audioKey" TEXT,
                   ADD COLUMN "audioMime" TEXT,
                   ADD COLUMN "audioBytes" INTEGER,
                   ADD COLUMN "audioSeconds" INTEGER;
