-- Structured fields used by admin-authored public pages. Existing pages remain
-- valid as general pages and are not populated with generated content.

BEGIN;

ALTER TABLE public.public_pages
  ADD COLUMN page_type text NOT NULL DEFAULT 'general',
  ADD COLUMN effective_date date,
  ADD COLUMN contact_details jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.public_pages
  ADD CONSTRAINT public_pages_type_check CHECK (
    page_type IN (
      'general',
      'about',
      'contact',
      'help',
      'legal_terms',
      'legal_privacy',
      'legal_refund',
      'legal_license'
    )
  ),
  ADD CONSTRAINT public_pages_contact_details_check CHECK (
    jsonb_typeof(contact_details) = 'array'
  ),
  ADD CONSTRAINT public_pages_legal_effective_date_check CHECK (
    status <> 'published'
    OR page_type NOT LIKE 'legal_%'
    OR effective_date IS NOT NULL
  );

COMMENT ON COLUMN public.public_pages.page_type IS
  'Selects the admin editing guide and public presentation; it does not generate legal text.';
COMMENT ON COLUMN public.public_pages.contact_details IS
  'Admin-managed contact and business facts such as email, phone, address, hours, and URLs.';

COMMIT;
