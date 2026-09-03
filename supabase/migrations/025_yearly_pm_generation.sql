-- ============================================
-- Migration 025: Yearly PM Generation Logic
-- ============================================

-- Function to generate 1 year of WOs for all PMs at once
CREATE OR REPLACE FUNCTION generate_yearly_pm_work_orders(
  p_year INT DEFAULT NULL
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
  v_start_date  DATE;
  v_end_date    DATE;
  v_check_date  DATE;
BEGIN
  -- Default to current year if not provided
  IF p_year IS NULL THEN p_year := EXTRACT(YEAR FROM now())::INT; END IF;

  v_start_date := make_date(p_year, 1, 1);
  v_end_date   := make_date(p_year, 12, 31);

  FOR pm IN
    SELECT
      pm_row.*,
      eq."namaEquipment" AS eq_name
    FROM preventive_maintenance pm_row
    JOIN equipment eq ON eq."idAset" = pm_row.equipment_id
    WHERE pm_row.status = 'scheduled'
  LOOP
    -- Start from plan_start, or today if plan_start is empty, but bounded by the requested year
    v_check_date := GREATEST(pm.plan_start, v_start_date);
    
    -- If the plan start is beyond this year, skip
    IF v_check_date > v_end_date THEN
      CONTINUE;
    END IF;

    -- Generate WOs up to the end of the requested year
    WHILE v_check_date <= v_end_date LOOP
      
      -- Avoid inserting duplicates if the WO is already generated for this exact date and PM
      IF NOT EXISTS (
        SELECT 1
        FROM work_orders wo
        WHERE wo.pm_id = pm.id
          AND wo.opened_at::DATE = v_check_date
      ) THEN
        
        -- Generate WO number Format: YYMMDD + sequence_no (To ensure uniqueness if multiple per month)
        v_wo_number := to_char(v_check_date, 'YYMMDD') || lpad(pm.sequence_no::text, 4, '0');

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

        result_equipment_id := pm.equipment_id;
        result_wo_number    := v_wo_number;
        result_wo_date      := v_check_date;
        result_status       := 'generated';
        RETURN NEXT;

      END IF;

      -- Move to the next interval
      v_check_date := v_check_date + pm.interval_days;
      
    END LOOP;

    -- Update next_due for the schedule, so UI knows the next cycle AFTER this year.
    UPDATE preventive_maintenance
    SET next_due = v_check_date
    WHERE id = pm.id;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_yearly_pm_work_orders(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_yearly_pm_work_orders(INT) TO anon;
