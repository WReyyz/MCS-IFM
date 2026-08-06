-- ============================================
-- Migration 003: WO Evidence & Cleanup
-- Jalankan di Supabase SQL Editor
-- ============================================

-- STEP 1: Tambah kolom evidence_url pada tabel work_orders
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS evidence_url TEXT;

-- STEP 2: Opsional, hapus kolom man_hours_estimated jika tidak diperlukan lagi
-- Namun demi kelancaran dan mencegah error pada query/kode lain yang mungkin menggunakannya,
-- kita biarkan kolom tersebut ada di database (nullable/default 0).
