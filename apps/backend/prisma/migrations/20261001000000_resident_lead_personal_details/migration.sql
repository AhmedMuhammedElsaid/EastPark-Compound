CREATE TYPE "MaritalStatus" AS ENUM ('MARRIED', 'SINGLE', 'DIVORCED');

ALTER TABLE "resident_leads"
ADD COLUMN "jobTitle" TEXT,
ADD COLUMN "maritalStatus" "MaritalStatus";