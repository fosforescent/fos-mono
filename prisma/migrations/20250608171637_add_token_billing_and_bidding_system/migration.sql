-- CreateTable
CREATE TABLE "UserModel" (
    "id" SERIAL NOT NULL,
    "user_name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "api_calls_available" INTEGER NOT NULL DEFAULT 0,
    "api_calls_used" INTEGER NOT NULL DEFAULT 0,
    "api_calls_total" INTEGER NOT NULL DEFAULT 0,
    "user_profile" JSONB NOT NULL DEFAULT '{}',
    "portal_session_id" TEXT,
    "subscription_checkout_session_id" TEXT,
    "stripe_connected_account_id" TEXT,
    "stripe_connect_enabled" BOOLEAN NOT NULL DEFAULT false,
    "stripe_connect_linked" BOOLEAN NOT NULL DEFAULT false,
    "stripe_customer_id" TEXT,
    "subscription_status" TEXT NOT NULL DEFAULT '',
    "email_confirmation_token" TEXT,
    "email_confirmation_expiration" TIMESTAMP(3),
    "password_reset_token" TEXT,
    "password_reset_expiration" TIMESTAMP(3),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "accepted_terms" TIMESTAMP(3) NOT NULL,
    "cookies" JSONB NOT NULL DEFAULT '{}',
    "data" JSONB NOT NULL DEFAULT '{}',
    "role" TEXT NOT NULL DEFAULT 'user',
    "fosNodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmailModel" (
    "id" SERIAL NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmailModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundEmailModel" (
    "id" SERIAL NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "templateAlias" TEXT NOT NULL,
    "templateModel" JSONB NOT NULL,

    CONSTRAINT "OutboundEmailModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundDeliveryAttemptModel" (
    "id" SERIAL NOT NULL,
    "emailId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "OutboundDeliveryAttemptModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEventModel" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL,
    "reason" TEXT,

    CONSTRAINT "UserEventModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientErrorModel" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" JSONB NOT NULL,

    CONSTRAINT "ClientErrorModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FosNodeUserAccessLinkModel" (
    "id" SERIAL NOT NULL,
    "fosNodeId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FosNodeUserAccessLinkModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FosNodeModel" (
    "cid" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "public" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "NodeVectorModel" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "NodeVectorModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FosAppModel" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FosAppModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolUseModel" (
    "id" SERIAL NOT NULL,
    "toolUseId" TEXT NOT NULL,
    "callerUserId" INTEGER NOT NULL,
    "targetUserId" INTEGER,
    "serverId" INTEGER,
    "toolName" TEXT NOT NULL,
    "toolDescription" TEXT,
    "inputParameters" JSONB NOT NULL DEFAULT '{}',
    "outputResult" JSONB DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "duration" INTEGER,
    "errorMessage" TEXT,
    "tokenCost" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ToolUseModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MCPServerModel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "lastPing" TIMESTAMP(3),
    "descriptionEmbedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MCPServerModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MCPToolModel" (
    "id" SERIAL NOT NULL,
    "serverId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inputSchema" JSONB NOT NULL DEFAULT '{}',
    "outputSchema" JSONB NOT NULL DEFAULT '{}',
    "descriptionEmbedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MCPToolModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMCPServerAccessModel" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "serverId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMCPServerAccessModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiTokenModel" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiTokenModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPromptModel" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "serverId" INTEGER,
    "promptId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "promptType" TEXT NOT NULL DEFAULT 'input',
    "options" JSONB DEFAULT '[]',
    "inputSchema" JSONB DEFAULT '{}',
    "defaultValue" TEXT,
    "response" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "expiresAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPromptModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTokenBalanceModel" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "availableTokens" INTEGER NOT NULL DEFAULT 0,
    "totalPurchased" INTEGER NOT NULL DEFAULT 0,
    "totalUsed" INTEGER NOT NULL DEFAULT 0,
    "subscriptionTokens" INTEGER NOT NULL DEFAULT 0,
    "purchasedTokens" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTokenBalanceModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenTransactionModel" (
    "id" SERIAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "toolUseId" TEXT,
    "tokenPurchaseId" INTEGER,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenTransactionModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPurchaseModel" (
    "id" SERIAL NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenAmount" INTEGER NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "pricePerTokenCents" DECIMAL(10,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripePaymentIntentId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenPurchaseModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MCPToolPricingModel" (
    "id" SERIAL NOT NULL,
    "serverId" INTEGER NOT NULL,
    "toolName" TEXT NOT NULL,
    "pricePerUseTokens" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MCPToolPricingModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolBidSessionModel" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "taskDescription" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolBidSessionModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolBidModel" (
    "id" SERIAL NOT NULL,
    "bidId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "serverId" INTEGER NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolDescription" TEXT,
    "tokenCost" INTEGER NOT NULL DEFAULT 0,
    "relevanceScore" DECIMAL(5,4),
    "bidReason" TEXT,
    "isChosen" BOOLEAN NOT NULL DEFAULT false,
    "chosenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolBidModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserModel_user_name_key" ON "UserModel"("user_name");

-- CreateIndex
CREATE UNIQUE INDEX "UserModel_subscription_checkout_session_id_key" ON "UserModel"("subscription_checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserModel_stripe_connected_account_id_key" ON "UserModel"("stripe_connected_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserModel_stripe_customer_id_key" ON "UserModel"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserModel_email_confirmation_token_key" ON "UserModel"("email_confirmation_token");

-- CreateIndex
CREATE UNIQUE INDEX "UserModel_password_reset_token_key" ON "UserModel"("password_reset_token");

-- CreateIndex
CREATE UNIQUE INDEX "UserModel_fosNodeId_key" ON "UserModel"("fosNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "FosNodeModel_cid_key" ON "FosNodeModel"("cid");

-- CreateIndex
CREATE INDEX "NodeVectorModel_embedding_idx" ON "NodeVectorModel"("embedding");

-- CreateIndex
CREATE UNIQUE INDEX "ToolUseModel_toolUseId_key" ON "ToolUseModel"("toolUseId");

-- CreateIndex
CREATE INDEX "ToolUseModel_callerUserId_createdAt_idx" ON "ToolUseModel"("callerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolUseModel_targetUserId_createdAt_idx" ON "ToolUseModel"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolUseModel_serverId_createdAt_idx" ON "ToolUseModel"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolUseModel_toolName_createdAt_idx" ON "ToolUseModel"("toolName", "createdAt");

-- CreateIndex
CREATE INDEX "ToolUseModel_status_createdAt_idx" ON "ToolUseModel"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MCPServerModel_name_key" ON "MCPServerModel"("name");

-- CreateIndex
CREATE INDEX "MCPServerModel_descriptionEmbedding_idx" ON "MCPServerModel"("descriptionEmbedding");

-- CreateIndex
CREATE INDEX "MCPToolModel_descriptionEmbedding_idx" ON "MCPToolModel"("descriptionEmbedding");

-- CreateIndex
CREATE UNIQUE INDEX "MCPToolModel_serverId_name_key" ON "MCPToolModel"("serverId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserMCPServerAccessModel_userId_serverId_key" ON "UserMCPServerAccessModel"("userId", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiTokenModel_token_key" ON "ApiTokenModel"("token");

-- CreateIndex
CREATE INDEX "ApiTokenModel_token_idx" ON "ApiTokenModel"("token");

-- CreateIndex
CREATE INDEX "ApiTokenModel_hashedToken_idx" ON "ApiTokenModel"("hashedToken");

-- CreateIndex
CREATE INDEX "ApiTokenModel_userId_isActive_idx" ON "ApiTokenModel"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserPromptModel_promptId_key" ON "UserPromptModel"("promptId");

-- CreateIndex
CREATE INDEX "UserPromptModel_userId_status_idx" ON "UserPromptModel"("userId", "status");

-- CreateIndex
CREATE INDEX "UserPromptModel_promptId_idx" ON "UserPromptModel"("promptId");

-- CreateIndex
CREATE INDEX "UserPromptModel_status_expiresAt_idx" ON "UserPromptModel"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserTokenBalanceModel_userId_key" ON "UserTokenBalanceModel"("userId");

-- CreateIndex
CREATE INDEX "UserTokenBalanceModel_userId_idx" ON "UserTokenBalanceModel"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenTransactionModel_transactionId_key" ON "TokenTransactionModel"("transactionId");

-- CreateIndex
CREATE INDEX "TokenTransactionModel_userId_createdAt_idx" ON "TokenTransactionModel"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenTransactionModel_toolUseId_idx" ON "TokenTransactionModel"("toolUseId");

-- CreateIndex
CREATE INDEX "TokenTransactionModel_transactionId_idx" ON "TokenTransactionModel"("transactionId");

-- CreateIndex
CREATE INDEX "TokenTransactionModel_type_createdAt_idx" ON "TokenTransactionModel"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TokenPurchaseModel_purchaseId_key" ON "TokenPurchaseModel"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenPurchaseModel_stripePaymentIntentId_key" ON "TokenPurchaseModel"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenPurchaseModel_stripeCheckoutSessionId_key" ON "TokenPurchaseModel"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "TokenPurchaseModel_userId_createdAt_idx" ON "TokenPurchaseModel"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenPurchaseModel_status_idx" ON "TokenPurchaseModel"("status");

-- CreateIndex
CREATE INDEX "TokenPurchaseModel_stripePaymentIntentId_idx" ON "TokenPurchaseModel"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "MCPToolPricingModel_serverId_idx" ON "MCPToolPricingModel"("serverId");

-- CreateIndex
CREATE INDEX "MCPToolPricingModel_toolName_idx" ON "MCPToolPricingModel"("toolName");

-- CreateIndex
CREATE UNIQUE INDEX "MCPToolPricingModel_serverId_toolName_key" ON "MCPToolPricingModel"("serverId", "toolName");

-- CreateIndex
CREATE UNIQUE INDEX "ToolBidSessionModel_sessionId_key" ON "ToolBidSessionModel"("sessionId");

-- CreateIndex
CREATE INDEX "ToolBidSessionModel_userId_createdAt_idx" ON "ToolBidSessionModel"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolBidSessionModel_sessionId_idx" ON "ToolBidSessionModel"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolBidModel_bidId_key" ON "ToolBidModel"("bidId");

-- CreateIndex
CREATE INDEX "ToolBidModel_sessionId_idx" ON "ToolBidModel"("sessionId");

-- CreateIndex
CREATE INDEX "ToolBidModel_serverId_toolName_idx" ON "ToolBidModel"("serverId", "toolName");

-- CreateIndex
CREATE INDEX "ToolBidModel_isChosen_createdAt_idx" ON "ToolBidModel"("isChosen", "createdAt");

-- CreateIndex
CREATE INDEX "ToolBidModel_tokenCost_idx" ON "ToolBidModel"("tokenCost");

-- AddForeignKey
ALTER TABLE "UserModel" ADD CONSTRAINT "UserModel_fosNodeId_fkey" FOREIGN KEY ("fosNodeId") REFERENCES "FosNodeModel"("cid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundDeliveryAttemptModel" ADD CONSTRAINT "OutboundDeliveryAttemptModel_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutboundEmailModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEventModel" ADD CONSTRAINT "UserEventModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientErrorModel" ADD CONSTRAINT "ClientErrorModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FosNodeUserAccessLinkModel" ADD CONSTRAINT "FosNodeUserAccessLinkModel_fosNodeId_fkey" FOREIGN KEY ("fosNodeId") REFERENCES "FosNodeModel"("cid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FosNodeUserAccessLinkModel" ADD CONSTRAINT "FosNodeUserAccessLinkModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeVectorModel" ADD CONSTRAINT "NodeVectorModel_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "FosNodeModel"("cid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolUseModel" ADD CONSTRAINT "ToolUseModel_callerUserId_fkey" FOREIGN KEY ("callerUserId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolUseModel" ADD CONSTRAINT "ToolUseModel_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "UserModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolUseModel" ADD CONSTRAINT "ToolUseModel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MCPServerModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolUseModel" ADD CONSTRAINT "ToolUseModel_sessionId_fkey" FOREIGN KEY ("toolUseId") REFERENCES "ToolBidSessionModel"("sessionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolUseModel" ADD CONSTRAINT "ToolUseModel_bidId_fkey" FOREIGN KEY ("toolUseId") REFERENCES "ToolBidModel"("bidId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MCPToolModel" ADD CONSTRAINT "MCPToolModel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MCPServerModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMCPServerAccessModel" ADD CONSTRAINT "UserMCPServerAccessModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMCPServerAccessModel" ADD CONSTRAINT "UserMCPServerAccessModel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MCPServerModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiTokenModel" ADD CONSTRAINT "ApiTokenModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPromptModel" ADD CONSTRAINT "UserPromptModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPromptModel" ADD CONSTRAINT "UserPromptModel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MCPServerModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTokenBalanceModel" ADD CONSTRAINT "UserTokenBalanceModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTransactionModel" ADD CONSTRAINT "TokenTransactionModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTransactionModel" ADD CONSTRAINT "TokenTransactionModel_toolUseId_fkey" FOREIGN KEY ("toolUseId") REFERENCES "ToolUseModel"("toolUseId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTransactionModel" ADD CONSTRAINT "TokenTransactionModel_tokenPurchaseId_fkey" FOREIGN KEY ("tokenPurchaseId") REFERENCES "TokenPurchaseModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPurchaseModel" ADD CONSTRAINT "TokenPurchaseModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MCPToolPricingModel" ADD CONSTRAINT "MCPToolPricingModel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MCPServerModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolBidSessionModel" ADD CONSTRAINT "ToolBidSessionModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolBidModel" ADD CONSTRAINT "ToolBidModel_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ToolBidSessionModel"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolBidModel" ADD CONSTRAINT "ToolBidModel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MCPServerModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
