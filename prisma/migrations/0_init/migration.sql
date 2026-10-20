-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'nl',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setup" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "ticketChannelId" TEXT DEFAULT '',
    "ticketCategoryId" TEXT DEFAULT '',
    "ticketStaffRoleId" TEXT DEFAULT '',
    "ticketLogChannelId" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "automodEnabled" BOOLEAN NOT NULL DEFAULT false,
    "automodChannelId" TEXT DEFAULT '',
    "automodRoleId" TEXT DEFAULT '',
    "automodChannelExceptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "automodRoleExceptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkRoleId" TEXT,
    "requestChannelId" TEXT,
    "logChannelId" TEXT,

    CONSTRAINT "Setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinecraftLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinecraftLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureRequest" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "channelId" TEXT,
    "messageId" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Setup_guildId_key" ON "Setup"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "MinecraftLink_userId_key" ON "MinecraftLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MinecraftLink_uuid_key" ON "MinecraftLink"("uuid");

-- CreateIndex
CREATE INDEX "MinecraftLink_name_idx" ON "MinecraftLink"("name");

-- CreateIndex
CREATE INDEX "AdminRole_guildId_idx" ON "AdminRole"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_guildId_roleId_key" ON "AdminRole"("guildId", "roleId");

-- CreateIndex
CREATE INDEX "FeatureRequest_guildId_idx" ON "FeatureRequest"("guildId");

-- CreateIndex
CREATE INDEX "FeatureRequest_status_idx" ON "FeatureRequest"("status");

-- AddForeignKey
ALTER TABLE "MinecraftLink" ADD CONSTRAINT "MinecraftLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

