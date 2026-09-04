-- One admin-managed image for the desktop sign-up visual. When it is inactive
-- or empty, the application keeps using its default image fallback.

CREATE TABLE public.signup_banner_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  image_path text CHECK (image_path IS NULL OR char_length(image_path) <= 500),
  alt_text text NOT NULL DEFAULT 'Weixies marketplace sign-up banner'
    CHECK (char_length(alt_text) BETWEEN 1 AND 160),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT signup_banner_active_image_check CHECK (NOT is_active OR image_path IS NOT NULL)
);

ALTER TABLE public.signup_banner_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active signup banner is publicly visible"
  ON public.signup_banner_settings FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "Platform admins can view signup banner settings"
  ON public.signup_banner_settings FOR SELECT TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can create signup banner settings"
  ON public.signup_banner_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can update signup banner settings"
  ON public.signup_banner_settings FOR UPDATE TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

GRANT SELECT ON public.signup_banner_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.signup_banner_settings TO authenticated;

CREATE FUNCTION public.set_signup_banner_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_signup_banner_metadata
  BEFORE INSERT OR UPDATE ON public.signup_banner_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_signup_banner_metadata();

CREATE FUNCTION public.audit_signup_banner_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_activity(
    auth.uid(),
    NULL,
    CASE WHEN TG_OP = 'INSERT' THEN 'signup_banner.created' ELSE 'signup_banner.updated' END,
    'signup_banner',
    'signup',
    jsonb_build_object('is_active', NEW.is_active, 'image_path', NEW.image_path)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_signup_banner_activity
  AFTER INSERT OR UPDATE ON public.signup_banner_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_signup_banner_activity();

INSERT INTO public.signup_banner_settings (id, is_active)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;
