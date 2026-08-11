-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  profile_img text,
  role USER-DEFINED NOT NULL DEFAULT 'user'::user_role,
  created_at timestamp with time zone DEFAULT now(),
  email text UNIQUE,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.cart (
  id uuid NOT NULL,
  profile_id uuid NOT NULL UNIQUE,
  CONSTRAINT cart_pkey PRIMARY KEY (id),
  CONSTRAINT cart_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.products (
  slug text UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  id bigint NOT NULL DEFAULT nextval('products_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT now(),
  file_url text,
  price integer DEFAULT 1,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cart_items (
  cart_id uuid NOT NULL,
  product_id bigint NOT NULL,
  id bigint NOT NULL DEFAULT nextval('cart_items_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.cart(id),
  CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_images (
  image_url text NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  CONSTRAINT product_images_pkey PRIMARY KEY (id),
  CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.categories (
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  id bigint NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_categories (
  product_id bigint,
  category_id bigint,
  id bigint NOT NULL DEFAULT nextval('product_categories_id_seq'::regclass),
  CONSTRAINT product_categories_pkey PRIMARY KEY (id),
  CONSTRAINT product_categories_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.reviews (
  product_id bigint,
  profile_id uuid,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT reviews_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.wishlists (
  profile_id uuid NOT NULL,
  product_id bigint NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wishlists_pkey PRIMARY KEY (id),
  CONSTRAINT fk_wishlist_profile FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.orders (
  payment_url text,
  snap_token text,
  snap_redirect_url text,
  profile_id uuid NOT NULL,
  order_number text NOT NULL UNIQUE,
  total_amount integer NOT NULL,
  payment_method text,
  midtrans_order_id text UNIQUE,
  midtrans_transaction_id text UNIQUE,
  paid_at timestamp with time zone,
  expired_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'expired'::text, 'cancelled'::text, 'refunded'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id uuid NOT NULL,
  product_id bigint NOT NULL,
  price integer NOT NULL,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.user_products (
  profile_id uuid NOT NULL,
  product_id bigint NOT NULL,
  order_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_products_pkey PRIMARY KEY (id),
  CONSTRAINT user_products_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT user_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT user_products_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.payments (
  provider text,
  provider_invoice_id text UNIQUE,
  payment_method text,
  status text,
  paid_at timestamp with time zone,
  order_id uuid NOT NULL,
  midtrans_transaction_id text,
  payment_type text,
  gross_amount integer,
  transaction_status text,
  fraud_status text,
  raw_response jsonb,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.download_logs (
  profile_id uuid NOT NULL,
  product_id bigint NOT NULL,
  ip_address inet,
  user_agent text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  downloaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT download_logs_pkey PRIMARY KEY (id),
  CONSTRAINT download_logs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT download_logs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.coupons (
  code text NOT NULL UNIQUE,
  discount integer NOT NULL,
  expired_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  max_usage integer DEFAULT 1,
  used_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_files (
  product_id bigint NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  version text DEFAULT '1.0.0'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_files_pkey PRIMARY KEY (id),
  CONSTRAINT product_files_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.coupon_usages (
  coupon_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  order_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupon_usages_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_usages_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id),
  CONSTRAINT coupon_usages_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT coupon_usages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);