-- ============================================
-- Migration 015: Fix RPC Permissions
-- ============================================

-- 1. Grant EXECUTE ke authenticated role
GRANT EXECUTE ON FUNCTION generate_daily_pm_work_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_next_wo_number() TO authenticated;

-- 2. Grant akses tabel wo_sequence
GRANT SELECT, INSERT, UPDATE ON TABLE wo_sequence TO authenticated;

-- 3. Alter fungsi pakai SECURITY DEFINER (bypass RLS)
CREATE OR REPLACE FUNCTION generate_next_wo_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yymm TEXT;
  v_seq  INT;
BEGIN
  v_yymm := to_char(now(), 'YYMM');
  INSERT INTO wo_sequence (year_month, last_seq)
  VALUES (v_yymm, 1)
  ON CONFLICT (year_month)
  DO UPDATE SET last_seq = wo_sequence.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_yymm || lpad(v_seq::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_daily_pm_work_orders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pm RECORD;
  v_wo_number TEXT;
  v_target_date DATE;
BEGIN
  v_target_date := current_date + interval '7 days';
  FOR pm IN
    SELECT * FROM preventive_maintenance
    WHERE status = 'scheduled'
      AND next_due <= v_target_date
      AND id NOT IN (
        SELECT pm_id FROM work_orders
        WHERE pm_id = preventive_maintenance.id
          AND status NOT IN ('closed', 'cancelled')
          AND pm_id IS NOT NULL
      )
  LOOP
    v_wo_number := generate_next_wo_number();
    INSERT INTO work_orders (wo_number, equipment_id, pm_id, mds_template_id, type, priority, status, description, opened_at, assigned_to)
    VALUES (v_wo_number, pm.equipment_id, pm.id, pm.mds_template_id, 'preventive', 'medium', 'generated',
      '[PM] ' || COALESCE(pm.title,'PREVENTIVE') || ' - ' || COALESCE(pm.equipment_id,''),
      COALESCE(pm.next_due::timestamptz, now()), pm.assigned_to);
  END LOOP;
END;
$$;

-- Re-grant setelah CREATE OR REPLACE
GRANT EXECUTE ON FUNCTION generate_daily_pm_work_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_next_wo_number() TO authenticated;
