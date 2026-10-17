-- Voice-note usage metering leaves the token ledger: one row per transcription, summed against the free budget.
-- Idempotent: the live database received this table through `prisma db push` before migrations were deployed,
-- but not the ledger carry-over below, which this migration still performs.
CREATE TABLE IF NOT EXISTS "VoiceUsageModel" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "usd" DOUBLE PRECISION NOT NULL,
    "tokens" INTEGER NOT NULL,
    "seconds" DOUBLE PRECISION NOT NULL,
    "bytes" INTEGER NOT NULL,
    "clusters" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceUsageModel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VoiceUsageModel_userId_createdAt_idx" ON "VoiceUsageModel"("userId", "createdAt");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VoiceUsageModel_userId_fkey') THEN
        ALTER TABLE "VoiceUsageModel" ADD CONSTRAINT "VoiceUsageModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Earlier voice-note debits were written into the ledger with a zero balance effect; carry them over as usage rows.
INSERT INTO "VoiceUsageModel" ("userId", "usd", "tokens", "seconds", "bytes", "clusters", "createdAt")
SELECT "userId",
       COALESCE(("metadata"->>'usd')::double precision, 0),
       COALESCE(("metadata"->>'tokens')::integer, -"amount"),
       COALESCE(("metadata"->>'seconds')::double precision, 0),
       COALESCE(("metadata"->>'bytes')::integer, 0),
       COALESCE(("metadata"->>'clusters')::integer, 0),
       "createdAt"
FROM "TokenTransactionModel"
WHERE "type" = 'debit' AND "description" LIKE 'Voice note%';

DELETE FROM "TokenTransactionModel" WHERE "type" = 'debit' AND "description" LIKE 'Voice note%';
