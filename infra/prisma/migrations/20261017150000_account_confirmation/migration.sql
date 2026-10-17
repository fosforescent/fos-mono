-- Accounts are confirmed with a code sent to an email address or phone number before they are approved.
-- Idempotent: the live database may already carry parts of this from an earlier `prisma db push`.
ALTER TABLE "UserModel" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "UserModel" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "UserModel" ADD COLUMN IF NOT EXISTS "confirmation_channel" TEXT;
ALTER TABLE "UserModel" ADD COLUMN IF NOT EXISTS "confirmation_code_hash" TEXT;
ALTER TABLE "UserModel" ADD COLUMN IF NOT EXISTS "confirmation_expiration" TIMESTAMP(3);

-- Existing accounts used the email address as the username; keep reaching them there.
-- Usernames that differ only by case would collide on the unique email, so those stay unset.
UPDATE "UserModel" u SET "email" = lower(u."user_name")
WHERE u."email" IS NULL AND u."user_name" LIKE '%@%.%'
  AND NOT EXISTS (SELECT 1 FROM "UserModel" o WHERE o."id" <> u."id" AND lower(o."user_name") = lower(u."user_name"))
  AND NOT EXISTS (SELECT 1 FROM "UserModel" o WHERE o."id" <> u."id" AND o."email" = lower(u."user_name"));

CREATE UNIQUE INDEX IF NOT EXISTS "UserModel_email_key" ON "UserModel"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "UserModel_phone_key" ON "UserModel"("phone");
