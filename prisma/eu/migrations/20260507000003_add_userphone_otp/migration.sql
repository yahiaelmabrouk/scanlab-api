-- Add OTP fields to UserPhones for SMS phone verification
ALTER TABLE "UserPhones"
  ADD COLUMN "otpCode" VARCHAR(6),
  ADD COLUMN "otpExpiresAt" TIMESTAMPTZ(6);
