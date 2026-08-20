-- Multi-seller marketplace migration
-- Seller access flag and store image storage
-- Date: 2026-08-20
--
-- Approval remains controlled by public.sellers.status. profiles.is_seller is
-- a derived access flag maintained only by database triggers.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_seller boolean NOT NULL DEFAULT false;

ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS store_image_url text;

-- Backfill accounts that were approved before this migration.
UPDATE public.profiles AS profiles
SET is_seller = EXISTS (
  SELECT 1
  FROM public.sellers AS sellers
  WHERE sellers.profile_id = profiles.id
    AND sellers.status = 'approved'
);

-- Prevent clients from granting seller access by updating their own profile.
-- The seller-status synchronization trigger temporarily enables this internal
-- transaction-local flag before updating profiles.is_seller.
CREATE OR REPLACE FUNCTION public.guard_profile_is_seller_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_seller IS DISTINCT FROM OLD.is_seller
     AND current_setting('weixies.syncing_seller_flag', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'is_seller is managed by seller approval status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_is_seller_update ON public.profiles;
CREATE TRIGGER guard_profile_is_seller_update
  BEFORE UPDATE OF is_seller ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_is_seller_update();

CREATE OR REPLACE FUNCTION public.sync_profile_is_seller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_profile_id uuid;
  target_is_seller boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_profile_id := OLD.profile_id;
    target_is_seller := false;
  ELSE
    target_profile_id := NEW.profile_id;
    target_is_seller := NEW.status = 'approved';
  END IF;

  PERFORM set_config('weixies.syncing_seller_flag', 'on', true);
  UPDATE public.profiles
  SET is_seller = target_is_seller
  WHERE id = target_profile_id
    AND is_seller IS DISTINCT FROM target_is_seller;
  PERFORM set_config('weixies.syncing_seller_flag', 'off', true);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_is_seller ON public.sellers;
CREATE TRIGGER sync_profile_is_seller
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_is_seller();

-- Append the public store photo to the existing deliberately narrow storefront
-- view without exposing private seller payout/commission fields.
CREATE OR REPLACE VIEW public.approved_seller_stores AS
  SELECT id, store_name, store_slug, store_description, created_at, store_image_url
  FROM public.sellers
  WHERE status = 'approved';

REVOKE ALL ON public.approved_seller_stores FROM PUBLIC;
GRANT SELECT ON public.approved_seller_stores TO anon, authenticated;

-- Public store images. Each authenticated user can only write inside a folder
-- named with their own auth UID: <profile-id>/<generated-file-name>.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seller-shop-images',
  'seller-shop-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view seller shop images" ON storage.objects;
CREATE POLICY "Public can view seller shop images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'seller-shop-images');

DROP POLICY IF EXISTS "Users can upload their seller shop image" ON storage.objects;
CREATE POLICY "Users can upload their seller shop image"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'seller-shop-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their seller shop image" ON storage.objects;
CREATE POLICY "Users can update their seller shop image"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'seller-shop-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'seller-shop-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their seller shop image" ON storage.objects;
CREATE POLICY "Users can delete their seller shop image"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'seller-shop-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

