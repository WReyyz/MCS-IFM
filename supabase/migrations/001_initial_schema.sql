-- ============================================
-- MCS (Maintenance Control System) Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('admin', 'technician')),
  department TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Equipment table
CREATE TABLE IF NOT EXISTS equipment (
  "idAset" TEXT PRIMARY KEY,
  "namaEquipment" TEXT NOT NULL,
  area TEXT DEFAULT '',
  kategori TEXT DEFAULT '',
  "noInventory" TEXT DEFAULT '',
  manuf TEXT DEFAULT '',
  type TEXT DEFAULT '',
  kondisi TEXT DEFAULT '',
  checklist JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Preventive Maintenance schedule
CREATE TABLE IF NOT EXISTS preventive_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id TEXT REFERENCES equipment("idAset") ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  interval_days INT NOT NULL DEFAULT 30,
  checklist JSONB DEFAULT '[]',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_done DATE,
  next_due DATE,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'overdue', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Work Orders
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number TEXT UNIQUE NOT NULL,
  equipment_id TEXT REFERENCES equipment("idAset") ON DELETE SET NULL,
  pm_id UUID REFERENCES preventive_maintenance(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'corrective' CHECK (type IN ('corrective', 'preventive')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  description TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  man_hours_estimated NUMERIC(8,2) DEFAULT 0,
  man_hours_actual NUMERIC(8,2) DEFAULT 0,
  opened_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Material Stock
CREATE TABLE IF NOT EXISTS material_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  quantity INT NOT NULL DEFAULT 0,
  min_stock INT DEFAULT 5,
  unit TEXT DEFAULT 'pcs',
  location TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  price NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Material Usage (per Work Order)
CREATE TABLE IF NOT EXISTS material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  material_id UUID REFERENCES material_stock(id) ON DELETE SET NULL,
  quantity_used INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Technician Schedule (on/off duty)
CREATE TABLE IF NOT EXISTS technician_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  shift TEXT DEFAULT 'pagi' CHECK (shift IN ('pagi', 'siang', 'malam')),
  status TEXT NOT NULL DEFAULT 'on_duty' CHECK (status IN ('on_duty', 'off_duty', 'leave', 'sick')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Activity Log (audit trail)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE preventive_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own. Admin can do everything.
CREATE POLICY "Profiles: read all" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: insert own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: update own or admin" ON profiles FOR UPDATE USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Profiles: admin delete" ON profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Equipment, PM, WO, Material, Schedule, Log: authenticated users can read; admin can write
CREATE POLICY "Equipment: read" ON equipment FOR SELECT USING (true);
CREATE POLICY "Equipment: insert" ON equipment FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Equipment: update" ON equipment FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Equipment: delete" ON equipment FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "PM: read" ON preventive_maintenance FOR SELECT USING (true);
CREATE POLICY "PM: insert" ON preventive_maintenance FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "PM: update" ON preventive_maintenance FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "PM: delete" ON preventive_maintenance FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "WO: read" ON work_orders FOR SELECT USING (true);
CREATE POLICY "WO: insert" ON work_orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "WO: update" ON work_orders FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "WO: delete" ON work_orders FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Material: read" ON material_stock FOR SELECT USING (true);
CREATE POLICY "Material: insert" ON material_stock FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Material: update" ON material_stock FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Material: delete" ON material_stock FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "MaterialUsage: read" ON material_usage FOR SELECT USING (true);
CREATE POLICY "MaterialUsage: insert" ON material_usage FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "MaterialUsage: delete" ON material_usage FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Schedule: read" ON technician_schedule FOR SELECT USING (true);
CREATE POLICY "Schedule: insert" ON technician_schedule FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Schedule: update" ON technician_schedule FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Schedule: delete" ON technician_schedule FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Log: read" ON activity_log FOR SELECT USING (true);
CREATE POLICY "Log: insert" ON activity_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- Trigger: auto-create profile on user sign up
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'technician')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Trigger: auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON preventive_maintenance FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON material_stock FOR EACH ROW EXECUTE FUNCTION update_updated_at();
