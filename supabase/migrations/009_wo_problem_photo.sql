ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS problem_photo_url TEXT;
