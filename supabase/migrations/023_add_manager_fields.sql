-- ============================================
-- Migration 023: Extend roles and add manager approval fields to work_orders
-- ============================================

-- 1. Extend role CHECK constraint in profiles to include planner and manager
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (
  role IN ('admin', 'planner', 'technician', 'inspector', 'manager')
);

-- 2. Extend status CHECK constraint in work_orders to include new workflow statuses
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check CHECK (
  status IN (
    'open',
    'in_progress',
    'pending_inspection',
    'pending_manager_approval',
    'rejected_to_inspector',
    'closed'
  )
);

-- 3. Add manager approval columns to work_orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS manager_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS manager_comment TEXT;

-- 4. (Optional) Set a default status for existing rows with a NULL status
-- UPDATE work_orders SET status = 'open' WHERE status IS NULL;

-- ============================================
-- End Migration
-- ============================================
