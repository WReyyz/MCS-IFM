-- ============================================
-- Migration 020: Seed MDS for Clean room - General Facility
-- ============================================

-- 1. Insert Template
INSERT INTO mds_templates (name, kategori_equipment, interval_days, form_number, revision)
VALUES (
  'Clean room - General Facility',
  'Clean room - General Facility',
  30,
  '401-13-01',
  '0'
)
ON CONFLICT DO NOTHING;

-- 2. Insert checklist items
DO $$
DECLARE
  v_tpl_id UUID;
BEGIN
  SELECT id INTO v_tpl_id FROM mds_templates WHERE name = 'Clean room - General Facility' LIMIT 1;

  IF v_tpl_id IS NULL THEN
    RAISE EXCEPTION 'Template tidak ditemukan';
  END IF;

  -- Bersihkan item lama jika ada (untuk re-run safe)
  DELETE FROM mds_template_items WHERE template_id = v_tpl_id;

  -- SECTION 1: Area dalam Clean Room
  INSERT INTO mds_template_items (template_id, section, activity_title, order_idx) VALUES
  (v_tpl_id, 'Area dalam Clean Room', 'Periksa dan bersihkan lantai dari debu dan beberapa material bekas produksi, gunakan sapu dan kain pel', 10),
  (v_tpl_id, 'Area dalam Clean Room', 'Periksa dan bersihkan dinding dari debu yang menempel, gunakan kain majun.', 20),
  (v_tpl_id, 'Area dalam Clean Room', 'Periksa dan bersihkan pintu dari debu yang menempel,periksa roda pada sliding door dan seal pintu', 30),
  (v_tpl_id, 'Area dalam Clean Room', 'Periksa dan bersihkan plafon dari debu, gunakan kain majun / sapu nylon', 40);

  -- SECTION 2: Instalasi MEP
  INSERT INTO mds_template_items (template_id, section, activity_title, order_idx) VALUES
  (v_tpl_id, 'Instalasi MEP', 'Periksa dan bersihkan source instalasi plumbing pneumatic dan water dari debu dan kebocoran', 50),
  (v_tpl_id, 'Instalasi MEP', 'Pastikan valvve- valve berfungsi normal / chek open-close', 60);
  
  INSERT INTO mds_template_items (template_id, section, activity_title, needs_input, expected_unit, order_idx) VALUES
  (v_tpl_id, 'Instalasi MEP', 'Periksa fungsi saklar dan lampu dalam area kerja, ukur nilai lumen dengan jarak normal.', true, 'Lumen', 70);

  -- SECTION 3: Parameter clean room Bearing inspection
  INSERT INTO mds_template_items (template_id, section, activity_title, needs_input, expected_unit, order_idx) VALUES
  (v_tpl_id, 'Parameter clean room Bearing inspection', 'Temperatur', true, '°C', 80),
  (v_tpl_id, 'Parameter clean room Bearing inspection', 'Humidity', true, '%', 90),
  (v_tpl_id, 'Parameter clean room Bearing inspection', 'Static pressure dalam clean room', true, 'Pa', 100),
  (v_tpl_id, 'Parameter clean room Bearing inspection', 'Air flow supply', true, 'm/s', 110),
  (v_tpl_id, 'Parameter clean room Bearing inspection', 'Air flow Return', true, 'm/s', 120);

  -- SECTION 4: Parameter clean room Cleaning area
  INSERT INTO mds_template_items (template_id, section, activity_title, needs_input, expected_unit, order_idx) VALUES
  (v_tpl_id, 'Parameter clean room Cleaning area', 'Temperatur', true, '°C', 130),
  (v_tpl_id, 'Parameter clean room Cleaning area', 'Humidity', true, '%', 140),
  (v_tpl_id, 'Parameter clean room Cleaning area', 'Static pressure dalam clean room', true, 'Pa', 150),
  (v_tpl_id, 'Parameter clean room Cleaning area', 'Air flow supply', true, 'm/s', 160),
  (v_tpl_id, 'Parameter clean room Cleaning area', 'Air flow Return', true, 'm/s', 170);

  -- SECTION 5: Parameter clean room Ante room
  INSERT INTO mds_template_items (template_id, section, activity_title, needs_input, expected_unit, order_idx) VALUES
  (v_tpl_id, 'Parameter clean room Ante room', 'Temperatur', true, '°C', 180),
  (v_tpl_id, 'Parameter clean room Ante room', 'Humidity', true, '%', 190),
  (v_tpl_id, 'Parameter clean room Ante room', 'Static pressure dalam clean room', true, 'Pa', 200),
  (v_tpl_id, 'Parameter clean room Ante room', 'Air flow supply', true, 'm/s', 210),
  (v_tpl_id, 'Parameter clean room Ante room', 'Air flow Return', true, 'm/s', 220);

END $$;
