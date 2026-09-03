-- ============================================
-- Migration 026: Fix WO Status Constraint
-- ============================================

-- The previous migration (023) accidentally overwrote the PM statuses.
-- This migration restores all previous statuses along with the new ones.

ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check CHECK (
  status IN (
    'open',
    'in_progress',
    'pending_inspection',
    'pending_manager_approval',
    'rejected_to_inspector',
    'closed',
    'generated',
    'diploting',
    'menunggu_approval',
    'revisi',
    'hold',
    'cancelled'
  )
);
