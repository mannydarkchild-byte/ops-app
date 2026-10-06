-- Make ops-media private. App uses createSignedUrl for display/download.
-- Authenticated users may read/upload/update objects in the bucket.
-- Object paths are not per-user; site isolation for media relies on not
-- leaking paths in other sites' rows (enforced by table RLS in 021).

UPDATE storage.buckets
SET public = false
WHERE id = 'ops-media';

INSERT INTO storage.buckets (id, name, public)
VALUES ('ops-media', 'ops-media', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS ops_media_read ON storage.objects;
DROP POLICY IF EXISTS ops_media_insert ON storage.objects;
DROP POLICY IF EXISTS ops_media_update ON storage.objects;
DROP POLICY IF EXISTS ops_media_delete ON storage.objects;

CREATE POLICY ops_media_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ops-media');

CREATE POLICY ops_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ops-media');

CREATE POLICY ops_media_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ops-media')
  WITH CHECK (bucket_id = 'ops-media');

CREATE POLICY ops_media_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ops-media' AND public.user_role() = 'admin');
