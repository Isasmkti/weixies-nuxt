-- New and updated marketplace products and license tiers must have a positive
-- price. NOT VALID preserves any historical zero-price rows until they can be
-- reviewed separately, while still enforcing the rule for new writes.

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_positive_price_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_positive_price_check
  CHECK (price IS NOT NULL AND price > 0) NOT VALID;

ALTER TABLE public.product_licenses
  DROP CONSTRAINT IF EXISTS product_licenses_positive_price_check;

ALTER TABLE public.product_licenses
  ADD CONSTRAINT product_licenses_positive_price_check
  CHECK (price > 0) NOT VALID;
