-- ============================================
-- Migration 022: RLS policies for wo_assignees
-- ============================================

-- Enable RLS
ALTER TABLE wo_assignees ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_wo_assignees" ON wo_assignees
  FOR ALL
  TO authenticated
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

-- Teknisi: hanya bisa baca assignment milik dirinya
CREATE POLICY "tech_read_own_wo_assignees" ON wo_assignees
  FOR SELECT
  TO authenticated
  USING (technician_id = auth.uid());
