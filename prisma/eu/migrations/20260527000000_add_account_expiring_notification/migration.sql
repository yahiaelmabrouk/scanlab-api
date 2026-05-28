-- AlterEnum: add the ACCOUNT_EXPIRING notification type (account-expiry reminder).
-- Safe on PostgreSQL 12+: the new value is not referenced in this migration.
ALTER TYPE "enum_NotificationType" ADD VALUE IF NOT EXISTS 'ACCOUNT_EXPIRING';
