-- ============================================
-- Migration 022: RLS wo_assignees + closed_by
-- ============================================

-- 1. Enable RLS on wo_assignees
ALTER TABLE wo_assignees ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any (safe to run again)
DROP POLICY IF EXISTS "admin_all_wo_assignees" ON wo_assignees;
DROP POLICY IF EXISTS "tech_read_own_wo_assignees" ON wo_assignees;
DROP POLICY IF EXISTS "tech_read_team_wo_assignees" ON wo_assignees;

-- 3. Admin/supervisor: full access to wo_assignees
CREATE POLICY "admin_all_wo_assignees" ON wo_assignees
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- 4. Teknisi: bisa baca SEMUA baris untuk WO yang dia terlibat
--    (bukan hanya barisnya sendiri, agar bisa lihat seluruh nama tim)
CREATE POLICY "tech_read_team_wo_assignees" ON wo_assignees
  FOR SELECT TO authenticated
  USING (
    wo_id IN (
      SELECT wo_id FROM wo_assignees WHERE technician_id = auth.uid()
    )
  );

-- 5. Tambah kolom closed_by ke work_orders
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
