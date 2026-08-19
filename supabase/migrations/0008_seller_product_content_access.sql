-- Multi-seller marketplace migration
-- Phase 2 follow-up: seller-owned product metadata and ZIP upload access.
-- Product files remain private; buyer downloads continue through the existing
-- server endpoint after payment validation.

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published product images"
  ON public.product_images FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_images.product_id AND products.status = 'published'));
CREATE POLICY "Sellers can manage own product images"
  ON public.product_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products JOIN public.sellers ON sellers.id = products.seller_id WHERE products.id = product_images.product_id AND sellers.profile_id = auth.uid() AND sellers.status = 'approved'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products JOIN public.sellers ON sellers.id = products.seller_id WHERE products.id = product_images.product_id AND sellers.profile_id = auth.uid() AND sellers.status = 'approved'));
CREATE POLICY "Platform admins can manage product images"
  ON public.product_images FOR ALL TO authenticated
  USING (public.is_seller_platform_admin()) WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Public can read published product categories"
  ON public.product_categories FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_categories.product_id AND products.status = 'published'));
CREATE POLICY "Sellers can manage own product categories"
  ON public.product_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products JOIN public.sellers ON sellers.id = products.seller_id WHERE products.id = product_categories.product_id AND sellers.profile_id = auth.uid() AND sellers.status = 'approved'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products JOIN public.sellers ON sellers.id = products.seller_id WHERE products.id = product_categories.product_id AND sellers.profile_id = auth.uid() AND sellers.status = 'approved'));
CREATE POLICY "Platform admins can manage product categories"
  ON public.product_categories FOR ALL TO authenticated
  USING (public.is_seller_platform_admin()) WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Sellers can manage own product files"
  ON public.product_files FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products JOIN public.sellers ON sellers.id = products.seller_id WHERE products.id = product_files.product_id AND sellers.profile_id = auth.uid() AND sellers.status = 'approved'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products JOIN public.sellers ON sellers.id = products.seller_id WHERE products.id = product_files.product_id AND sellers.profile_id = auth.uid() AND sellers.status = 'approved'));
CREATE POLICY "Platform admins can manage product files"
  ON public.product_files FOR ALL TO authenticated
  USING (public.is_seller_platform_admin()) WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Sellers can upload own product ZIP files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'products'
    AND split_part(name, '/', 1) ~ '^[0-9]+$'
    AND EXISTS (
      SELECT 1
      FROM public.products
      JOIN public.sellers ON sellers.id = products.seller_id
      WHERE products.id = split_part(name, '/', 1)::bigint
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  );
