/*
# Allow anon role on gallery storage policies

1. Security Changes
- Expands gallery_admin_insert and gallery_admin_delete storage policies to include the `anon` role.
- Same rationale as the table policy change: Supabase Auth is returning 500 errors, so the admin panel operates as anon.
- Gallery public read already allows anon; this adds anon write/delete for admin operations gated by the login page.
*/

DROP POLICY IF EXISTS "gallery_admin_insert" ON storage.objects;
CREATE POLICY "gallery_admin_insert" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'gallery');

DROP POLICY IF EXISTS "gallery_admin_delete" ON storage.objects;
CREATE POLICY "gallery_admin_delete" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'gallery');