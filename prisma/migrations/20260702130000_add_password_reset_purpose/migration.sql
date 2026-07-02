ALTER TABLE "PasswordReset"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'password_reset';