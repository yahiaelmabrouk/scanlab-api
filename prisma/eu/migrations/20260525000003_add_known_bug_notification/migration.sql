-- AlterEnum: add the KNOWN_BUG notification type (admin-broadcast announcement).
-- Safe on PostgreSQL 12+: the new value is not referenced in this migration.
ALTER TYPE "enum_NotificationType" ADD VALUE IF NOT EXISTS 'KNOWN_BUG';
