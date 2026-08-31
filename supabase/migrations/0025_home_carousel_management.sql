-- Admin-managed promo and news carousel for the authenticated home page.
-- This migration is additive and does not modify existing marketplace data.

CREATE TABLE public.home_carousel_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL DEFAULT 'promo'
    CHECK (content_type IN ('promo', 'news')),
  badge text NOT NULL DEFAULT '' CHECK (char_length(badge) <= 60),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 320),
  image_path text CHECK (image_path IS NULL OR char_length(image_path) <= 500),
  button_label text NOT NULL DEFAULT 'Learn More' CHECK (char_length(button_label) BETWEEN 1 AND 40),
  link_url text NOT NULL DEFAULT '/products'
    CHECK (link_url ~ '^/[^/]' OR link_url ~ '^https://'),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT home_carousel_schedule_check CHECK (
    ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at
  )
);

CREATE INDEX home_carousel_items_public_idx
  ON public.home_carousel_items (is_active, sort_order, published_at DESC);

ALTER TABLE public.home_carousel_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active home carousel items are publicly visible"
  ON public.home_carousel_items
  FOR SELECT
  TO public
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY "Platform admins can view all home carousel items"
  ON public.home_carousel_items
  FOR SELECT
  TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can create home carousel items"
  ON public.home_carousel_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can update home carousel items"
  ON public.home_carousel_items
  FOR UPDATE
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can delete home carousel items"
  ON public.home_carousel_items
  FOR DELETE
  TO authenticated
  USING (public.is_seller_platform_admin());

GRANT SELECT ON public.home_carousel_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_carousel_items TO authenticated;

CREATE FUNCTION public.set_home_carousel_item_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  END IF;

  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER set_home_carousel_item_metadata
  BEFORE INSERT OR UPDATE ON public.home_carousel_items
  FOR EACH ROW EXECUTE FUNCTION public.set_home_carousel_item_metadata();

CREATE FUNCTION public.audit_home_carousel_item_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  logged_item public.home_carousel_items%ROWTYPE;
  activity_action text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    logged_item := OLD;
    activity_action := 'home_carousel.deleted';
  ELSIF TG_OP = 'INSERT' THEN
    logged_item := NEW;
    activity_action := 'home_carousel.created';
  ELSE
    logged_item := NEW;
    activity_action := 'home_carousel.updated';
  END IF;

  PERFORM public.record_activity(
    auth.uid(),
    NULL,
    activity_action,
    'home_carousel',
    logged_item.id::text,
    jsonb_build_object(
      'title', logged_item.title,
      'content_type', logged_item.content_type,
      'is_active', logged_item.is_active
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_home_carousel_item_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.home_carousel_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_home_carousel_item_activity();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'home-carousel',
  'home-carousel',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public can view home carousel images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'home-carousel');

CREATE POLICY "Platform admins can upload home carousel images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'home-carousel'
    AND public.is_seller_platform_admin()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Platform admins can update home carousel images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'home-carousel'
    AND public.is_seller_platform_admin()
  )
  WITH CHECK (
    bucket_id = 'home-carousel'
    AND public.is_seller_platform_admin()
  );

CREATE POLICY "Platform admins can delete home carousel images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'home-carousel'
    AND public.is_seller_platform_admin()
  );
