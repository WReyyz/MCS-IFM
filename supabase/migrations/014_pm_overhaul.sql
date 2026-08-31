-- ============================================
-- Migration 014: PM Overhaul (PRD v1.0)
-- ============================================

-- 1. TRUNCATE old PM and WO data as approved by user
TRUNCATE TABLE work_orders CASCADE;
TRUNCATE TABLE preventive_maintenance CASCADE;

-- 2. MDS Templates (Master)
CREATE TABLE IF NOT EXISTS mds_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kategori_equipment TEXT NOT NULL,
  interval_days INT NOT NULL,
  form_number TEXT DEFAULT '',
  revision TEXT DEFAULT '0',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. MDS Template Items (Detail per template)
CREATE TABLE IF NOT EXISTS mds_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES mds_templates(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  activity_title TEXT NOT NULL,
  description TEXT DEFAULT '',
  needs_input BOOLEAN DEFAULT false,
  expected_unit TEXT DEFAULT '',
  order_idx INT DEFAULT 0
);

-- 4. Alter preventive_maintenance to link to template
ALTER TABLE preventive_maintenance 
ADD COLUMN IF NOT EXISTS mds_template_id UUID REFERENCES mds_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS plan_start DATE;

-- 5. Alter work_orders for new statuses and PM fields
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check 
  CHECK (status IN ('open', 'in_progress', 'closed', 'generated', 'diploting', 'menunggu_approval', 'revisi', 'hold'));

ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS mds_template_id UUID REFERENCES mds_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS inspector_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reject_notes TEXT;

-- 6. WO Checklist Results
CREATE TABLE IF NOT EXISTS wo_checklist_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES mds_template_items(id) ON DELETE CASCADE,
  result TEXT CHECK (result IN ('Pass', 'Failed', 'N/A')),
  measurement_value NUMERIC(10,2),
  notes TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Approval Logs
CREATE TABLE IF NOT EXISTS approval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('submit', 'approve', 'reject')),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Sequence table for WO Number generation
CREATE TABLE IF NOT EXISTS wo_sequence (
  year_month TEXT PRIMARY KEY,
  last_seq INT NOT NULL DEFAULT 0
);

-- Function to generate next WO number (YYMM+NNNN)
CREATE OR REPLACE FUNCTION generate_next_wo_number()
RETURNS TEXT AS $$
DECLARE
  v_yymm TEXT;
  v_seq INT;
  v_result TEXT;
BEGIN
  -- Get YYMM format (e.g. 2608)
  v_yymm := to_char(now(), 'YYMM');
  
  -- Upsert sequence for current month
  INSERT INTO wo_sequence (year_month, last_seq)
  VALUES (v_yymm, 1)
  ON CONFLICT (year_month) 
  DO UPDATE SET last_seq = wo_sequence.last_seq + 1
  RETURNING last_seq INTO v_seq;
  
  -- Format with padding (e.g. 26080001)
  v_result := v_yymm || lpad(v_seq::text, 4, '0');
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 9. Auto-Generate WO Function (Triggered daily by pg_cron)
CREATE OR REPLACE FUNCTION generate_daily_pm_work_orders()
RETURNS VOID AS $$
DECLARE
  pm RECORD;
  v_wo_number TEXT;
  v_target_date DATE;
BEGIN
  -- Window generation: e.g., generate if next_due is within 7 days from now
  v_target_date := current_date + interval '7 days';
  
  FOR pm IN 
    SELECT * FROM preventive_maintenance 
    WHERE status = 'scheduled' 
      AND next_due <= v_target_date
      AND id NOT IN (
        -- Mencegah duplikasi: pastikan tidak ada WO PM yg masih belum closed untuk jadwal ini
        SELECT pm_id FROM work_orders 
        WHERE pm_id = preventive_maintenance.id 
          AND status NOT IN ('closed', 'cancelled')
      )
  LOOP
    -- Generate new WO number
    v_wo_number := generate_next_wo_number();
    
    -- Insert WO
    INSERT INTO work_orders (
      wo_number,
      equipment_id,
      pm_id,
      mds_template_id,
      type,
      priority,
      status,
      description,
      opened_at,
      assigned_to
    ) VALUES (
      v_wo_number,
      pm.equipment_id,
      pm.id,
      pm.mds_template_id,
      'preventive',
      'medium',
      'generated',
      '[PM] ' || pm.title || ' - ' || pm.equipment_id,
      pm.next_due::timestamptz,
      pm.assigned_to
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 10. Enable pg_cron and schedule it
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Ensure no duplicate job safely
DO $$
BEGIN
  PERFORM cron.unschedule('generate-pm-wo-daily');
EXCEPTION WHEN OTHERS THEN
  -- ignore error if job does not exist
END $$;

SELECT cron.schedule('generate-pm-wo-daily', '0 0 * * *', 'SELECT generate_daily_pm_work_orders()');

-- RLS Policies for new tables
ALTER TABLE mds_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE mds_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wo_checklist_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wo_sequence ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read, admins can do all. Technicians can insert/update checklist results.
CREATE POLICY "MDS Templates: read" ON mds_templates FOR SELECT USING (true);
CREATE POLICY "MDS Templates: write" ON mds_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "MDS Template Items: read" ON mds_template_items FOR SELECT USING (true);
CREATE POLICY "MDS Template Items: write" ON mds_template_items FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "WO Checklist Results: read" ON wo_checklist_results FOR SELECT USING (true);
CREATE POLICY "WO Checklist Results: insert" ON wo_checklist_results FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "WO Checklist Results: update" ON wo_checklist_results FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "WO Checklist Results: delete" ON wo_checklist_results FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Approval Logs: read" ON approval_logs FOR SELECT USING (true);
CREATE POLICY "Approval Logs: insert" ON approval_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- trigger for updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON mds_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

