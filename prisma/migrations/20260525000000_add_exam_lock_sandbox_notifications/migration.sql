-- AlterEnum: add notification event types for cohort exam lock/sandbox changes.
-- ALTER TYPE ... ADD VALUE cannot reuse the new value in the same transaction,
-- but these values are not referenced here, so this is safe on PostgreSQL 12+.
ALTER TYPE "enum_NotificationType" ADD VALUE IF NOT EXISTS 'EXAM_UNLOCKED';
ALTER TYPE "enum_NotificationType" ADD VALUE IF NOT EXISTS 'EXAM_SANDBOX_ENABLED';
ALTER TYPE "enum_NotificationType" ADD VALUE IF NOT EXISTS 'EXAM_SANDBOX_DISABLED';
