-- ============================================
-- Migration: Add Inspector Role and Checklist Fields
-- ============================================

-- 1. Update roles in profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'technician', 'inspector'));

-- 2. Update status in work_orders
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check CHECK (status IN ('open', 'in_progress', 'pending_inspection', 'closed'));

-- 3. Add new columns for structured checklist and inspection data
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS checklist_result JSONB DEFAULT '{}';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ;
