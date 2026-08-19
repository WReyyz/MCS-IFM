-- Migration 008: Technician Notifications & Profile Avatar
-- Run this in Supabase SQL Editor

-- Table for admin broadcast notifications to all technicians
CREATE TABLE IF NOT EXISTS public.technician_notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title      text NOT NULL,
  body       text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for ordering by newest first
CREATE INDEX IF NOT EXISTS idx_tech_notifs_created_at 
  ON public.technician_notifications(created_at DESC);

-- Add avatar_url to profiles if not exists
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Enable RLS
ALTER TABLE public.technician_notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all notifications
CREATE POLICY "Everyone can read notifications"
  ON public.technician_notifications
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert notifications
CREATE POLICY "Admin can insert notifications"
  ON public.technician_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admin can delete notifications
CREATE POLICY "Admin can delete notifications"
  ON public.technician_notifications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
