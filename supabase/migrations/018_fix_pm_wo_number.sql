-- ============================================
-- Migration 018: Fix PM WO Number format
-- ============================================

CREATE OR REPLACE FUNCTION generate_monthly_pm_work_orders(
  p_year  INT DEFAULT NULL,
  p_month INT DEFAULT NULL
)
RETURNS TABLE(
  result_equipment_id TEXT,
  result_wo_number    TEXT,
  result_wo_date      DATE,
  result_status       TEXT
) AS $$
DECLARE
  pm            RECORD;
  v_wo_number   TEXT;
  v_month_start DATE;
  v_month_end   DATE;
  v_check_date  DATE;
  v_diff_days   INT;
  v_remainder   INT;
BEGIN
  -- Default ke bulan berjalan jika tidak diberikan
  IF p_year IS NULL  THEN p_year  := EXTRACT(YEAR  FROM now())::INT; END IF;
  IF p_month IS NULL THEN p_month := EXTRACT(MONTH FROM now())::INT; END IF;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end   := (v_month_start + interval '1 month' - interval '1 day')::DATE;

  FOR pm IN
    SELECT
      pm_row.*,
      eq."namaEquipment" AS eq_name
    FROM preventive_maintenance pm_row
    JOIN equipment eq ON eq."idAset" = pm_row.equipment_id
    WHERE pm_row.status = 'scheduled'
      AND pm_row.plan_start IS NOT NULL
  LOOP
    -- Iterasi setiap hari dalam bulan
    v_check_date := v_month_start;

    WHILE v_check_date <= v_month_end LOOP

      IF pm.plan_start <= v_check_date THEN
        -- Hitung selisih hari dari plan_start
        v_diff_days := v_check_date - pm.plan_start;
        v_remainder := v_diff_days % pm.interval_days;

        -- Jika hari ini adalah tanggal due (kelipatan interval dari plan_start)
        IF v_remainder = 0 THEN

          -- Cek duplikat: belum ada WO aktif untuk jadwal ini di tanggal ini
          IF NOT EXISTS (
            SELECT 1
            FROM work_orders wo
            WHERE wo.pm_id  = pm.id
              AND wo.status NOT IN ('closed')
              AND wo.opened_at::DATE = v_check_date
          ) THEN
            -- Generate WO number Format: YYMM + sequence_no 
            v_wo_number := to_char(v_check_date, 'YYMM') || lpad(pm.sequence_no::text, 4, '0');

            -- Insert WO
            INSERT INTO work_orders (
              wo_number, equipment_id, pm_id, mds_template_id,
              type, priority, status, description, opened_at, assigned_to
            ) VALUES (
              v_wo_number,
              pm.equipment_id,
              pm.id,
              pm.mds_template_id,
              'preventive',
              'medium',
              'generated',
              '[PM] ' || COALESCE(pm.eq_name, pm.equipment_id) || ' - ' || to_char(v_check_date, 'DD Mon YYYY'),
              v_check_date::TIMESTAMPTZ,
              pm.assigned_to
            );

            -- Update next_due ke plan berikutnya sesuai interval
            UPDATE preventive_maintenance
            SET next_due = v_check_date + pm.interval_days
            WHERE id = pm.id;

            -- Kembalikan hasil sebagai row
            result_equipment_id := pm.equipment_id;
            result_wo_number    := v_wo_number;
            result_wo_date      := v_check_date;
            result_status       := 'generated';
            RETURN NEXT;

          END IF;
        END IF;
      END IF;

      -- Maju 1 hari
      v_check_date := v_check_date + 1;

    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
