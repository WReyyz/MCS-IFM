-- ============================================
-- Migration 004: Password Reset Function (RPC)
-- Jalankan di Supabase SQL Editor
-- ============================================

CREATE OR REPLACE FUNCTION reset_user_password(user_email TEXT, new_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update password di tabel auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
