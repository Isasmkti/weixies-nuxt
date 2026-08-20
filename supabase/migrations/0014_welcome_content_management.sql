-- Editable public welcome-page content.
-- The product carousel remains sourced from published products and is not
-- represented in this table.

CREATE TABLE public.welcome_content (
  section text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  CONSTRAINT welcome_content_pkey PRIMARY KEY (section),
  CONSTRAINT welcome_content_section_check CHECK (
    section = ANY (ARRAY[
      'navbar'::text,
      'hero'::text,
      'features'::text,
      'about'::text,
      'testimonials'::text,
      'cta'::text,
      'footer'::text
    ])
  ),
  CONSTRAINT welcome_content_object_check CHECK (jsonb_typeof(content) = 'object')
);

ALTER TABLE public.welcome_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Welcome content is publicly visible"
  ON public.welcome_content
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Platform admins can create welcome content"
  ON public.welcome_content
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can update welcome content"
  ON public.welcome_content
  FOR UPDATE
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can delete welcome content"
  ON public.welcome_content
  FOR DELETE
  TO authenticated
  USING (public.is_seller_platform_admin());

GRANT SELECT ON public.welcome_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.welcome_content TO authenticated;

INSERT INTO public.welcome_content (section, content)
VALUES
  ('navbar', $json$
    {
      "brandName": "Weixies",
      "loginLabel": "Login",
      "signupLabel": "Sign Up",
      "dashboardLabel": "Dashboard"
    }
  $json$::jsonb),
  ('hero', $json$
    {
      "image": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&q=80",
      "title": "Welcome to Weixies",
      "description": "Discover premium products crafted for the modern lifestyle. Shop smart, live better.",
      "primaryLabel": "Browse Catalog",
      "primaryUrl": "/products",
      "secondaryLabel": "Learn More",
      "secondaryUrl": "#about"
    }
  $json$::jsonb),
  ('features', $json$
    {
      "eyebrow": "Why Choose Us",
      "title": "A better way to shop online",
      "description": "We prioritize your experience with top-tier services and premium quality products.",
      "items": [
        {"id": "global-shipping", "name": "Global Shipping", "description": "Fast and reliable delivery to over 120 countries worldwide.", "icon": "globe"},
        {"id": "best-prices", "name": "Best Prices", "description": "Competitive pricing with regular sales and exclusive member deals.", "icon": "scale"},
        {"id": "lightning-fast", "name": "Lightning Fast", "description": "Optimized checkout in seconds. Your time is precious.", "icon": "lightning"},
        {"id": "secure-safe", "name": "Secure & Safe", "description": "End-to-end encrypted payments and buyer protection on every order.", "icon": "shield"}
      ]
    }
  $json$::jsonb),
  ('about', $json$
    {
      "title": "About Us",
      "subtitle": "We exist to make great products accessible to everyone.",
      "description": "Weixies was founded with one simple belief — everyone deserves access to quality products at fair prices. We partner with the best brands and artisans to bring you a curated selection of goods that make life a little better every day."
    }
  $json$::jsonb),
  ('testimonials', $json$
    {
      "eyebrow": "Testimonials",
      "title": "Trusted by industry leading",
      "highlight": "innovators",
      "description": "Join 1,000+ companies worldwide who rely on Weixies for high-performance web products.",
      "items": [
        {"id": "sarah-johnson", "quote": "Weixies transformed how our team shops for office supplies. Fast delivery, great prices, and the quality is consistently outstanding.", "image": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80", "author": "Sarah Johnson", "role": "Operations Manager, TechCorp"},
        {"id": "michael-chen", "quote": "I've been a loyal customer for two years. The curated selection and seamless checkout experience keeps me coming back.", "image": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80", "author": "Michael Chen", "role": "Founder, Design Studio"},
        {"id": "emma-williams", "quote": "The product quality exceeded my expectations. Customer support was responsive and resolved my query within minutes.", "image": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80", "author": "Emma Williams", "role": "Creative Director, Brand Co."}
      ]
    }
  $json$::jsonb),
  ('cta', $json$
    {
      "eyebrow": "Call to action",
      "title": "Start shopping today.",
      "subtitle": "No subscriptions. Just great products.",
      "primaryLabel": "Browse Catalog",
      "primaryUrl": "/products",
      "secondaryLabel": "Learn More",
      "secondaryUrl": "#about"
    }
  $json$::jsonb),
  ('footer', $json$
    {
      "brandName": "Weixies",
      "description": "Making web development simple, fast, and accessible for everyone. Build your dream project today.",
      "facebookUrl": "#",
      "githubUrl": "#",
      "columns": [
        {"title": "Products", "links": [{"label": "Website Templates", "url": "/products"}, {"label": "Landing Pages", "url": "/products"}, {"label": "UI Kits", "url": "/products"}, {"label": "Admin Dashboards", "url": "/products"}]},
        {"title": "Help & Support", "links": [{"label": "Pricing", "url": "#"}, {"label": "Documentation", "url": "#"}, {"label": "Tutorials", "url": "#"}, {"label": "Contact Support", "url": "#"}]},
        {"title": "Company", "links": [{"label": "About Us", "url": "#about"}, {"label": "Blog", "url": "#"}, {"label": "Careers", "url": "#"}, {"label": "Affiliates", "url": "#"}]},
        {"title": "Legal", "links": [{"label": "License", "url": "#"}, {"label": "Refund Policy", "url": "#"}, {"label": "Privacy Policy", "url": "#"}, {"label": "Terms & Conditions", "url": "#"}]}
      ],
      "copyright": "© 2026 Weixies Webshop. All rights reserved.",
      "designedText": "Designed with love for the community."
    }
  $json$::jsonb)
ON CONFLICT (section) DO NOTHING;

CREATE FUNCTION public.set_welcome_content_update_metadata()
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

CREATE TRIGGER set_welcome_content_update_metadata
  BEFORE INSERT OR UPDATE ON public.welcome_content
  FOR EACH ROW EXECUTE FUNCTION public.set_welcome_content_update_metadata();

CREATE FUNCTION public.audit_welcome_content_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_activity(
    auth.uid(),
    NULL,
    CASE WHEN TG_OP = 'INSERT' THEN 'welcome_content.created' ELSE 'welcome_content.updated' END,
    'welcome_content',
    NEW.section,
    jsonb_build_object('section', NEW.section)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_welcome_content_activity
  AFTER INSERT OR UPDATE ON public.welcome_content
  FOR EACH ROW EXECUTE FUNCTION public.audit_welcome_content_activity();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'welcome-assets',
  'welcome-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public can view welcome assets"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'welcome-assets');

CREATE POLICY "Platform admins can upload welcome assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'welcome-assets'
    AND public.is_seller_platform_admin()
  );

CREATE POLICY "Platform admins can update welcome assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'welcome-assets'
    AND public.is_seller_platform_admin()
  )
  WITH CHECK (
    bucket_id = 'welcome-assets'
    AND public.is_seller_platform_admin()
  );

CREATE POLICY "Platform admins can delete welcome assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'welcome-assets'
    AND public.is_seller_platform_admin()
  );
