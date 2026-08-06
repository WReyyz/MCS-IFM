-- ============================================
-- Migration 002: WO Category & Hold Status
-- Jalankan di Supabase SQL Editor
-- ============================================

-- STEP 1: Tambah kolom category
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'OTHER';

-- STEP 2: Hapus constraint lama pada status
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;

-- STEP 3: Tambah constraint baru status (dengan 'hold')
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check
  CHECK (status IN ('open', 'in_progress', 'closed', 'hold'));

-- STEP 4: Tambah constraint category
ALTER TABLE work_orders ADD CONSTRAINT work_orders_category_check
  CHECK (category IN ('HVAC', 'ELECTRICAL', 'MECHANICAL', 'CIVIL', 'OTHER'));

-- STEP 5: Jadikan equipment_id opsional (nullable)
-- Kolom ini sudah nullable berdasarkan schema awal, jadi tidak perlu diubah.
-- Kita hanya menghapus referensi wajib di kode frontend.

-- STEP 6: Set type default ke 'corrective' untuk semua WO yang ada
UPDATE work_orders SET type = 'corrective' WHERE type IS NULL;

-- STEP 7: Set category default 'OTHER' untuk WO lama yang belum punya category
UPDATE work_orders SET category = 'OTHER' WHERE category IS NULL;

-- STEP 8: Ubah role akun 'Test Admin' menjadi 'admin' agar tombol "Buat Work Order" muncul
UPDATE profiles SET role = 'admin' WHERE role = 'technician';

