-- ============================================
-- Insert Template MDS: Clean room - Split duct
-- Jalankan di Supabase SQL Editor setelah migration 016
-- ============================================

-- 1. Insert template
INSERT INTO mds_templates (name, kategori_equipment, interval_days, form_number, revision)
VALUES (
  'Clean room - Split duct',
  'Clean room - Split duct',
  30,
  '401-13-02',
  '0'
)
ON CONFLICT DO NOTHING;

-- 2. Insert checklist items
DO $$
DECLARE
  v_tpl_id UUID;
BEGIN
  SELECT id INTO v_tpl_id FROM mds_templates WHERE name = 'Clean room - Split duct' LIMIT 1;

  IF v_tpl_id IS NULL THEN
    RAISE EXCEPTION 'Template tidak ditemukan';
  END IF;

  -- Section 1: General chek
  INSERT INTO mds_template_items (template_id, section, activity_title, description, needs_input, expected_unit, order_idx)
  VALUES
    (v_tpl_id, 'General Check', 'Periksa dan bersihkan area sekitar unit AC split duct dari debu dan sampah', '', false, '', 1),
    (v_tpl_id, 'General Check', 'Periksa kondisi unit outdoor dan indoor', '', false, '', 2);

  -- Section 2: Instalasi MEP
  INSERT INTO mds_template_items (template_id, section, activity_title, description, needs_input, expected_unit, order_idx)
  VALUES
    (v_tpl_id, 'Instalasi MEP', 'Periksa dan bersihkan instalasi plumbing dan cek fungsi valve', '', false, '', 3),
    (v_tpl_id, 'Instalasi MEP', 'Periksa jalur drainase, pastikan tidak mampat', '', false, '', 4);

  -- Section 3: Air Filter
  INSERT INTO mds_template_items (template_id, section, activity_title, description, needs_input, expected_unit, order_idx)
  VALUES
    (v_tpl_id, 'Air Filter', 'Periksa fungsi DPS (Deferial Pressure Sys) cek status filter', '', false, '', 5),
    (v_tpl_id, 'Air Filter', 'Periksa dan bersihkan pre filter', '', false, '', 6),
    (v_tpl_id, 'Air Filter', 'Periksa dan bersihkan Hepa Filter', '', false, '', 7);

  RAISE NOTICE 'Template Clean room - Split duct berhasil di-insert dengan 7 item checklist';
END $$;
