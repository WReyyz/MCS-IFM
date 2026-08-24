-- ============================================
-- Migration 012: Employee ID untuk Login
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Tambah kolom employee_id ke tabel profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE;

-- 2. Index untuk mempercepat lookup saat login
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id
  ON profiles (employee_id);

-- 3. Fungsi RPC: Ambil email auth.users berdasarkan employee_id
--    Dibutuhkan karena auth.users tidak bisa diakses dari frontend (anon key)
--    Fungsi ini berjalan dengan hak SECURITY DEFINER (service role)
CREATE OR REPLACE FUNCTION get_email_by_employee_id(emp_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT au.email INTO v_email
  FROM auth.users au
  INNER JOIN public.profiles p ON p.id = au.id
  WHERE p.employee_id = emp_id
  LIMIT 1;

  RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fungsi RPC: Reset password berdasarkan employee_id
--    Menggantikan reset_user_password yang berbasis email
CREATE OR REPLACE FUNCTION reset_password_by_employee_id(emp_id TEXT, new_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT au.id INTO v_user_id
  FROM auth.users au
  INNER JOIN public.profiles p ON p.id = au.id
  WHERE p.employee_id = emp_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = v_user_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
