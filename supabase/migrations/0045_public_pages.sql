-- Admin-managed public information pages. No content is seeded: administrators
-- must author and publish every page explicitly.

BEGIN;

CREATE TABLE public.public_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  title text NOT NULL,
  eyebrow text,
  summary text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title text,
  seo_description text,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamp with time zone,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT public_pages_path_check CHECK (
    path IN ('/about', '/contact', '/help')
    OR path ~ '^/(help|legal)/[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  CONSTRAINT public_pages_title_check CHECK (char_length(title) BETWEEN 3 AND 160),
  CONSTRAINT public_pages_sections_check CHECK (jsonb_typeof(sections) = 'array'),
  CONSTRAINT public_pages_status_check CHECK (status IN ('draft', 'published')),
  CONSTRAINT public_pages_publish_content_check CHECK (
    status = 'draft'
    OR (jsonb_array_length(sections) > 0 AND published_at IS NOT NULL)
  )
);

CREATE INDEX public_pages_status_path_idx ON public.public_pages (status, path);

CREATE OR REPLACE FUNCTION public.set_public_page_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
    IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_public_page_metadata
  BEFORE INSERT OR UPDATE ON public.public_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_public_page_metadata();

ALTER TABLE public.public_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published public pages are visible"
  ON public.public_pages FOR SELECT TO public
  USING (status = 'published');

CREATE POLICY "Platform admins can view all public pages"
  ON public.public_pages FOR SELECT TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can create public pages"
  ON public.public_pages FOR INSERT TO authenticated
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can update public pages"
  ON public.public_pages FOR UPDATE TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can delete public pages"
  ON public.public_pages FOR DELETE TO authenticated
  USING (public.is_seller_platform_admin());

GRANT SELECT ON public.public_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.public_pages TO authenticated;

COMMENT ON TABLE public.public_pages IS
  'Admin-authored public help, company, contact, and legal pages. No default legal copy is generated.';

COMMIT;
