-- CreateTable
CREATE TABLE "Blacklist" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "guildId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "reason" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Blacklist_guildId_idx" ON "Blacklist"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "Blacklist_guildId_discordId_key" ON "Blacklist"("guildId", "discordId");

