-- AlterTable
ALTER TABLE "Setup" DROP COLUMN "automodChannelExceptions",
DROP COLUMN "automodChannelId",
DROP COLUMN "automodEnabled",
DROP COLUMN "automodRoleExceptions",
DROP COLUMN "automodRoleId",
ADD COLUMN     "automodInviteRuleId" TEXT,
ADD COLUMN     "automodTimeoutEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "automodTimeoutMins" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "automodTimeoutStrikes" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "automodTimeoutWindowMins" INTEGER NOT NULL DEFAULT 10;

