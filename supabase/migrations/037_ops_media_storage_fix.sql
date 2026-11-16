-- ops-media: public read, authenticated write. Needed for meter / prestart photos.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ops-media', 'ops-media', true, 15728640)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = GREATEST(COALESCE(storage.buckets.file_size_limit, 0), 15728640);

DROP POLICY IF EXISTS ops_media_read ON storage.objects;
DROP POLICY IF EXISTS ops_media_insert ON storage.objects;
DROP POLICY IF EXISTS ops_media_update ON storage.objects;
DROP POLICY IF EXISTS ops_media_delete ON storage.objects;

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

CREATE POLICY ops_media_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'ops-media');
