-- Contact: replace fullName with firstName, lastName
ALTER TABLE "Contact" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Contact" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
UPDATE "Contact" SET
  "firstName" = COALESCE(TRIM(SPLIT_PART("fullName", ' ', 1)), ''),
  "lastName" = CASE WHEN POSITION(' ' IN COALESCE("fullName", '')) > 0 THEN COALESCE(TRIM(SUBSTRING("fullName" FROM POSITION(' ' IN "fullName") + 1)), '') ELSE '' END;
UPDATE "Contact" SET "firstName" = TRIM("fullName") WHERE "firstName" = '' AND TRIM(COALESCE("fullName", '')) <> '';
ALTER TABLE "Contact" ALTER COLUMN "firstName" DROP DEFAULT;
ALTER TABLE "Contact" ALTER COLUMN "lastName" DROP DEFAULT;
ALTER TABLE "Contact" DROP COLUMN "fullName";

-- Lead: replace fullName with firstName, lastName
ALTER TABLE "Lead" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
UPDATE "Lead" SET
  "firstName" = COALESCE(TRIM(SPLIT_PART("fullName", ' ', 1)), ''),
  "lastName" = CASE WHEN POSITION(' ' IN COALESCE("fullName", '')) > 0 THEN COALESCE(TRIM(SUBSTRING("fullName" FROM POSITION(' ' IN "fullName") + 1)), '') ELSE '' END;
UPDATE "Lead" SET "firstName" = TRIM("fullName") WHERE "firstName" = '' AND TRIM(COALESCE("fullName", '')) <> '';
ALTER TABLE "Lead" ALTER COLUMN "firstName" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "lastName" DROP DEFAULT;
ALTER TABLE "Lead" DROP COLUMN "fullName";
