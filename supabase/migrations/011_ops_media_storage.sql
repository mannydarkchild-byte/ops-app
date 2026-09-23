-- ops-media: allow authenticated uploads (INSERT + UPDATE for upsert)

INSERT INTO storage.buckets (id, name, public)
VALUES ('ops-media', 'ops-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS ops_media_read ON storage.objects;
DROP POLICY IF EXISTS ops_media_insert ON storage.objects;
DROP POLICY IF EXISTS ops_media_update ON storage.objects;

CREATE POLICY ops_media_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'ops-media');

CREATE POLICY ops_media_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ops-media');

CREATE POLICY ops_media_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'ops-media')
  WITH CHECK (bucket_id = 'ops-media');
