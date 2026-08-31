-- ============================================
-- Migration 021: Create wo_assignees table
-- ============================================

CREATE TABLE IF NOT EXISTS wo_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(wo_id, technician_id)
);
