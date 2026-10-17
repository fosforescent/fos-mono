-- Voice-note usage metering leaves the token ledger: one row per transcription, summed against the free budget.
CREATE TABLE "VoiceUsageModel" (
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

CREATE INDEX "VoiceUsageModel_userId_createdAt_idx" ON "VoiceUsageModel"("userId", "createdAt");

ALTER TABLE "VoiceUsageModel" ADD CONSTRAINT "VoiceUsageModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
