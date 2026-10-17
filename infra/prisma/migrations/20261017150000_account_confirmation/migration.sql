-- Accounts are confirmed with a code sent to an email address or phone number before they are approved.
ALTER TABLE "UserModel" ADD COLUMN "email" TEXT;
ALTER TABLE "UserModel" ADD COLUMN "phone" TEXT;
ALTER TABLE "UserModel" ADD COLUMN "confirmation_channel" TEXT;
ALTER TABLE "UserModel" ADD COLUMN "confirmation_code_hash" TEXT;
ALTER TABLE "UserModel" ADD COLUMN "confirmation_expiration" TIMESTAMP(3);

CREATE UNIQUE INDEX "UserModel_email_key" ON "UserModel"("email");
CREATE UNIQUE INDEX "UserModel_phone_key" ON "UserModel"("phone");

-- Existing accounts used the email address as the username; keep reaching them there.
UPDATE "UserModel" SET "email" = lower("user_name") WHERE "email" IS NULL AND "user_name" LIKE '%@%.%';
