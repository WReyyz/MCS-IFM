-- ============================================================
-- Migration: 006_shift_schedule_overhaul.sql
-- Purpose  : Add shift_master, equipment_maintenance_requirements,
--            and extend equipment / technician_schedule tables.
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. SHIFT MASTER TABLE
-- Stores editable shift codes and their working-hour durations.
CREATE TABLE IF NOT EXISTS shift_master (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  kode         TEXT    UNIQUE NOT NULL,           -- e.g. 'P1', 'P2', 'S1', 'O'
  label        TEXT    NOT NULL,                  -- e.g. '07:00 – 12:00'
  durasi_jam   NUMERIC(4,2) NOT NULL DEFAULT 0,   -- working hours in this shift
  is_off       BOOLEAN NOT NULL DEFAULT false,    -- true = Libur/Off (0 hours)
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Seed default shift codes (from requirements doc)
INSERT INTO shift_master (kode, label, durasi_jam, is_off) VALUES
  ('P1', '07:00 – 12:00', 5,  false),
  ('P2', '08:00 – 17:00', 9,  false),
  ('S2', '12:00 – 17:00', 5,  false),
  ('P3', '07:00 – 16:00', 9,  false),
  ('S1', '12:00 – 20:00', 8,  false),
  ('P',  '07:00 – 15:00', 8,  false),
  ('S',  '15:00 – 23:00', 8,  false),
  ('M',  '23:00 – 07:00', 8,  false),
  ('O',  'Libur / Off',   0,  true)
ON CONFLICT (kode) DO NOTHING;

-- RLS for shift_master
ALTER TABLE shift_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ShiftMaster: read"   ON shift_master FOR SELECT USING (true);
CREATE POLICY "ShiftMaster: insert" ON shift_master FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "ShiftMaster: update" ON shift_master FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "ShiftMaster: delete" ON shift_master FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. EQUIPMENT MAINTENANCE REQUIREMENTS TABLE
-- Stores one or more maintenance interval + man-hours records per equipment.
CREATE TABLE IF NOT EXISTS equipment_maintenance_requirements (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id   TEXT    NOT NULL REFERENCES equipment("idAset") ON DELETE CASCADE,
  interval_type  TEXT    NOT NULL
                   CHECK (interval_type IN ('daily','weekly','monthly','custom')),
  interval_days  INT     DEFAULT NULL,           -- only used when interval_type = 'custom'
  man_hours      NUMERIC(6,2) NOT NULL DEFAULT 0,
  description    TEXT    DEFAULT '',
  assigned_to    UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emr_equipment ON equipment_maintenance_requirements(equipment_id);
CREATE INDEX IF NOT EXISTS idx_emr_assigned  ON equipment_maintenance_requirements(assigned_to);

-- RLS
ALTER TABLE equipment_maintenance_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "EMR: read"   ON equipment_maintenance_requirements FOR SELECT USING (true);
CREATE POLICY "EMR: insert" ON equipment_maintenance_requirements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "EMR: update" ON equipment_maintenance_requirements FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "EMR: delete" ON equipment_maintenance_requirements FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3. ALTER EQUIPMENT TABLE
-- Add a default PIC / responsible technician at the equipment level.
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 4. ALTER TECHNICIAN_SCHEDULE TABLE
-- Add shift_code column (references shift_master.kode) alongside legacy shift column.
-- We keep the old 'shift' column so existing data is not broken.
ALTER TABLE technician_schedule
  ADD COLUMN IF NOT EXISTS shift_code TEXT REFERENCES shift_master(kode) ON DELETE SET NULL;

-- Optional index for date-range queries on the schedule
CREATE INDEX IF NOT EXISTS idx_ts_date ON technician_schedule(schedule_date);

-- We need a UNIQUE constraint to allow upserting via (profile_id, schedule_date)
ALTER TABLE technician_schedule DROP CONSTRAINT IF EXISTS technician_schedule_profile_date_key;
ALTER TABLE technician_schedule ADD CONSTRAINT technician_schedule_profile_date_key UNIQUE (profile_id, schedule_date);
