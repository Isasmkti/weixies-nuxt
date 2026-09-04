-- Cart rows are created by authenticated clients and server routes. Ensure the
-- primary key is always generated even when callers only provide profile_id.
ALTER TABLE public.cart
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
