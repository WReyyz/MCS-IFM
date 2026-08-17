-- ============================================
-- Migration 007: Add skill column to profiles
-- Purpose: Add technician skill field (HVAC, ME, CIVIL, INDUSTRIAL)
-- Run this in Supabase SQL Editor
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skill TEXT DEFAULT '';
