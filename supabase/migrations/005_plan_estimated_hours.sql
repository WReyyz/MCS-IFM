-- Migration: 005_plan_estimated_hours.sql
-- Add estimated man hours fields for Plan page Man Hours analysis

-- Add estimated hours to work_orders table
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS man_hours_estimated FLOAT DEFAULT 0;

-- Add estimated hours to preventive_maintenance table
ALTER TABLE preventive_maintenance
  ADD COLUMN IF NOT EXISTS estimated_hours FLOAT DEFAULT 0;

-- Optional: Add comment for documentation
COMMENT ON COLUMN work_orders.man_hours_estimated IS 'Estimated man hours required for this work order (used in Plan page Load Man Hours calculation)';
COMMENT ON COLUMN preventive_maintenance.estimated_hours IS 'Estimated man hours required for this PM task (used in Plan page Load Man Hours calculation)';
