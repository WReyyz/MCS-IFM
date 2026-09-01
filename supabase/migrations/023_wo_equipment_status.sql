-- ============================================
-- Migration 023: Equipment status & work hours fields for WO
-- ============================================

-- Tambah field equipment_status (serviceable/unserviceable) ke work_orders
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS equipment_status VARCHAR(20) DEFAULT NULL
    CHECK (equipment_status IN ('serviceable', 'unserviceable'));

-- started_at dan man_hours_actual sudah ada, pastikan ada
-- (jika belum ada, tambahkan)
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS man_hours_actual NUMERIC(10,2) DEFAULT NULL;
