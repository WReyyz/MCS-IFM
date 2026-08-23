-- ============================================
-- Migration 011: Tools Management Table
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT DEFAULT '',
  serial_number TEXT DEFAULT '',
  calibration_cert_no TEXT DEFAULT '',
  calibration_date DATE,
  calibration_expiry DATE,
  status TEXT DEFAULT 'baik',
  location TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tools: read" ON public.tools FOR SELECT USING (true);
CREATE POLICY "Tools: insert" ON public.tools FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Tools: update" ON public.tools FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Tools: delete" ON public.tools FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trigger for auto-update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.tools;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tools FOR EACH ROW EXECUTE FUNCTION update_updated_at();
