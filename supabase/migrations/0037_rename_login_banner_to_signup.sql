-- Forward compatibility for environments that applied the first 0036 draft
-- before the managed banner target was clarified as the sign-up page.
DO $$
BEGIN
  IF to_regclass('public.login_banner_settings') IS NOT NULL
     AND to_regclass('public.signup_banner_settings') IS NULL THEN
    ALTER TABLE public.login_banner_settings RENAME TO signup_banner_settings;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Active login banner is publicly visible" ON public.signup_banner_settings;
DROP POLICY IF EXISTS "Platform admins can view login banner settings" ON public.signup_banner_settings;
DROP POLICY IF EXISTS "Platform admins can create login banner settings" ON public.signup_banner_settings;
DROP POLICY IF EXISTS "Platform admins can update login banner settings" ON public.signup_banner_settings;
DROP POLICY IF EXISTS "Active signup banner is publicly visible" ON public.signup_banner_settings;
DROP POLICY IF EXISTS "Platform admins can view signup banner settings" ON public.signup_banner_settings;
DROP POLICY IF EXISTS "Platform admins can create signup banner settings" ON public.signup_banner_settings;
DROP POLICY IF EXISTS "Platform admins can update signup banner settings" ON public.signup_banner_settings;

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

DROP TRIGGER IF EXISTS set_login_banner_metadata ON public.signup_banner_settings;
DROP TRIGGER IF EXISTS audit_login_banner_activity ON public.signup_banner_settings;
DROP TRIGGER IF EXISTS set_signup_banner_metadata ON public.signup_banner_settings;
DROP TRIGGER IF EXISTS audit_signup_banner_activity ON public.signup_banner_settings;

CREATE OR REPLACE FUNCTION public.set_signup_banner_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN NEW.updated_by := auth.uid(); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_signup_banner_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_activity(
    auth.uid(), NULL,
    CASE WHEN TG_OP = 'INSERT' THEN 'signup_banner.created' ELSE 'signup_banner.updated' END,
    'signup_banner', 'signup',
    jsonb_build_object('is_active', NEW.is_active, 'image_path', NEW.image_path)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_signup_banner_metadata
  BEFORE INSERT OR UPDATE ON public.signup_banner_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_signup_banner_metadata();
CREATE TRIGGER audit_signup_banner_activity
  AFTER INSERT OR UPDATE ON public.signup_banner_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_signup_banner_activity();

DROP FUNCTION IF EXISTS public.set_login_banner_metadata();
DROP FUNCTION IF EXISTS public.audit_login_banner_activity();

UPDATE public.signup_banner_settings
SET alt_text = 'Weixies marketplace sign-up banner'
WHERE alt_text = 'Weixies marketplace sign-in banner';
