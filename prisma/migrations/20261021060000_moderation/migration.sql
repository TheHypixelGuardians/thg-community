-- AlterTable
ALTER TABLE "Setup" ADD COLUMN     "modLogChannelId" TEXT;

-- CreateTable
CREATE TABLE "ModCase" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT,
    "durationSeconds" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "dmSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModCase_guildId_targetId_idx" ON "ModCase"("guildId", "targetId");

