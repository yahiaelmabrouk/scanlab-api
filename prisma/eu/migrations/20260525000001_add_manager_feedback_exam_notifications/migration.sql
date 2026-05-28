-- AlterEnum: add notification event types for cohort-manager-facing events
-- (student replied to feedback, student completed a prepared exam).
-- Safe on PostgreSQL 12+: the new values are not referenced in this migration.
ALTER TYPE "enum_NotificationType" ADD VALUE IF NOT EXISTS 'FEEDBACK_REPLIED';
ALTER TYPE "enum_NotificationType" ADD VALUE IF NOT EXISTS 'STUDENT_EXAM_COMPLETED';
