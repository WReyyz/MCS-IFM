-- ============================================
-- Migration 022 (FIXED): RLS wo_assignees + closed_by
-- Perbaikan: hindari infinite recursion dengan SECURITY DEFINER function
-- ============================================

-- 1. Enable RLS on wo_assignees
ALTER TABLE wo_assignees ENABLE ROW LEVEL SECURITY;

-- 2. Drop semua policy lama (safe to run again)
DROP POLICY IF EXISTS "admin_all_wo_assignees"        ON wo_assignees;
DROP POLICY IF EXISTS "tech_read_own_wo_assignees"    ON wo_assignees;
DROP POLICY IF EXISTS "tech_read_team_wo_assignees"   ON wo_assignees;

-- 3. Buat fungsi SECURITY DEFINER untuk cek apakah user adalah assignee suatu WO
--    SECURITY DEFINER = berjalan sebagai pemilik fungsi (superuser), bukan caller,
--    sehingga tidak terkena RLS dan tidak menyebabkan rekursi
DROP FUNCTION IF EXISTS auth_is_wo_assignee(UUID);
CREATE OR REPLACE FUNCTION auth_is_wo_assignee(p_wo_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS 
  SELECT EXISTS (
    SELECT 1 FROM wo_assignees
    WHERE wo_id = p_wo_id
      AND technician_id = auth.uid()
  );
;

-- 4. Admin/supervisor: akses penuh
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

-- 5. Teknisi: baca SEMUA baris untuk WO yang dia ikut
--    Menggunakan fungsi SECURITY DEFINER — tidak rekursif
CREATE POLICY "tech_read_team_wo_assignees" ON wo_assignees
  FOR SELECT TO authenticated
  USING (auth_is_wo_assignee(wo_id));

-- 6. Tambah kolom closed_by ke work_orders
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
