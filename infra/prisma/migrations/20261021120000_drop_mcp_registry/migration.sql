-- The old MCP registry, tool market and API-token layer was removed from the backend (routes, handlers, Temporal
-- worker). Its tables go with it. MCPServerModel, MCPToolModel and UserMCPServerAccessModel stay: MCP peers
-- (backend/integrations/mcpPeers.ts) read them. Idempotent, like the other migrations.

ALTER TABLE IF EXISTS "TokenTransactionModel" DROP CONSTRAINT IF EXISTS "TokenTransactionModel_toolUseId_fkey";

DROP TABLE IF EXISTS "ToolUseModel" CASCADE;
DROP TABLE IF EXISTS "ToolBidModel" CASCADE;
DROP TABLE IF EXISTS "ToolBidSessionModel" CASCADE;
DROP TABLE IF EXISTS "MCPToolPricingModel" CASCADE;
DROP TABLE IF EXISTS "UserPromptModel" CASCADE;
DROP TABLE IF EXISTS "ApiTokenModel" CASCADE;
DROP TABLE IF EXISTS "VoiceNoteModel" CASCADE;
DROP TABLE IF EXISTS "FosAppModel" CASCADE;

-- the registry's semantic search columns (backend/embedding.ts), never part of the Prisma schema
DROP INDEX IF EXISTS "MCPServerModel_descriptionEmbedding_idx";
DROP INDEX IF EXISTS "MCPToolModel_descriptionEmbedding_idx";
ALTER TABLE IF EXISTS "MCPServerModel" DROP COLUMN IF EXISTS "descriptionEmbedding";
ALTER TABLE IF EXISTS "MCPToolModel" DROP COLUMN IF EXISTS "descriptionEmbedding";
