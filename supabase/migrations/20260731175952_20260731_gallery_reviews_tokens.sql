/*
# Gallery uploads, review tokens, and public review submission

1. Changes
   - Add `review_tokens` table for one-time secure review request links
   - Add public INSERT policy to `reviews` so customers can submit via token
   - Add `approved` column to `reviews` (replaces using `featured` for approval state)
   - Create `gallery` Supabase Storage bucket with public read access

2. New Tables
   - `review_tokens`
     - `id` (uuid, primary key)
     - `appointment_id` (uuid, FK to appointments)
     - `customer_name` (text) — pre-filled on the review form
     - `vehicle` (text) — pre-filled on the review form
     - `customer_email` (text) — for reference
     - `used` (boolean, default false) — marks token as consumed after submission
     - `created_at` (timestamptz)

3. Modified Tables
   - `reviews`: add `approved` boolean column (default false) so new submissions are hidden until admin approves

4. Security
   - `review_tokens`: anon can SELECT (to validate token on form load), authenticated admin has full CRUD
   - `review_tokens`: anon can UPDATE (to mark used=true when submitted)
   - `reviews`: add anon INSERT policy so customers can submit without being logged in
   - `reviews`: admin UPDATE/DELETE already exist from initial schema

5. Notes
   - The `approved` column is the gating flag for public display. The existing `featured` column remains for "highlight on homepage" once approved.
   - Tokens are single-use: the review page sets `used = true` on submit.
*/

-- Add approved column to reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'approved'
  ) THEN
    ALTER TABLE reviews ADD COLUMN approved boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add review_tokens table
CREATE TABLE IF NOT EXISTS review_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  vehicle text NOT NULL DEFAULT '',
  customer_email text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE review_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_review_tokens" ON review_tokens;
CREATE POLICY "anon_select_review_tokens" ON review_tokens FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_review_tokens" ON review_tokens;
CREATE POLICY "anon_update_review_tokens" ON review_tokens FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_insert_review_tokens" ON review_tokens;
CREATE POLICY "admin_insert_review_tokens" ON review_tokens FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_review_tokens" ON review_tokens;
CREATE POLICY "admin_delete_review_tokens" ON review_tokens FOR DELETE
  TO authenticated USING (true);

-- Allow customers to submit reviews (anon INSERT)
DROP POLICY IF EXISTS "anon_insert_reviews" ON reviews;
CREATE POLICY "anon_insert_reviews" ON reviews FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Create gallery storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for gallery bucket
DROP POLICY IF EXISTS "gallery_public_read" ON storage.objects;
CREATE POLICY "gallery_public_read" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "gallery_admin_insert" ON storage.objects;
CREATE POLICY "gallery_admin_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'gallery');

DROP POLICY IF EXISTS "gallery_admin_delete" ON storage.objects;
CREATE POLICY "gallery_admin_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'gallery');
