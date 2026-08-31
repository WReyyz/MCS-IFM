-- ============================================
-- Migration 019: Fix PM Generation Logic (Based on next_due and WO Close)
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
      AND pm_row.next_due IS NOT NULL
  LOOP
    -- Jika next_due jatuh di bulan ini, atau sudah terlewat
    IF pm.next_due <= v_month_end THEN

      -- Pastikan belum ada WO yang AKTIF (menunggu di-close) untuk PM ini.
      -- Ini memastikan PM hanya di-generate sekali. Bulan depan akan di-generate lagi 
      -- SETELAH WO sebelumnya di-close (yang otomatis mengupdate next_due di app).
      IF NOT EXISTS (
        SELECT 1
        FROM work_orders wo
        WHERE wo.pm_id = pm.id
          AND wo.status NOT IN ('closed', 'cancelled')
      ) THEN
        
        -- Kita set tanggal WO = next_due
        v_check_date := pm.next_due;
        
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

        -- Update next_due agar UI Jadwal PM menampilkan jadwal berikutnya.
        -- Nanti ketika WO ini di-close, approval.js akan MENG-OVERWRITE next_due ini 
        -- menjadi tanggal_close + interval, sesuai permintaan "mengikuti tanggal close terakhir".
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

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
