-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'user'::user_role,
  profile_img text,
  created_at timestamp with time zone DEFAULT now(),
  email text UNIQUE,
  is_seller boolean NOT NULL DEFAULT false,
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
  id bigint NOT NULL DEFAULT nextval('products_id_seq'::regclass),
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  price integer DEFAULT 1,
  slug text UNIQUE,
  file_url text,
  seller_id uuid,
  status text NOT NULL DEFAULT 'published'::text CHECK (status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'published'::text, 'rejected'::text, 'suspended'::text])),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
);
CREATE TABLE public.cart_items (
  id bigint NOT NULL DEFAULT nextval('cart_items_id_seq'::regclass),
  cart_id uuid NOT NULL,
  product_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.cart(id),
  CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  image_url text NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  storage_path text,
  CONSTRAINT product_images_pkey PRIMARY KEY (id),
  CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.categories (
  id bigint NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_categories (
  id bigint NOT NULL DEFAULT nextval('product_categories_id_seq'::regclass),
  product_id bigint,
  category_id bigint,
  CONSTRAINT product_categories_pkey PRIMARY KEY (id),
  CONSTRAINT product_categories_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint,
  profile_id uuid,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT reviews_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.wishlists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  product_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wishlists_pkey PRIMARY KEY (id),
  CONSTRAINT fk_wishlist_profile FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  order_number text NOT NULL UNIQUE,
  total_amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'expired'::text, 'cancelled'::text, 'refunded'::text])),
  payment_method text,
  midtrans_order_id text UNIQUE,
  midtrans_transaction_id text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  paid_at timestamp with time zone,
  expired_at timestamp with time zone,
  snap_token text,
  snap_redirect_url text,
  payment_url text,
  fulfilled_at timestamp with time zone,
  invoice_creation_token uuid,
  invoice_creation_started_at timestamp with time zone,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id uuid NOT NULL,
  product_id bigint NOT NULL,
  price integer NOT NULL,
  seller_id uuid,
  commission_amount integer NOT NULL DEFAULT 0 CHECK (commission_amount >= 0) NOT VALI),
  seller_earning integer NOT NULL DEFAULT 0 CHECK (seller_earning >= 0) NOT VALI),
  payout_status text NOT NULL DEFAULT 'pending'::text CHECK (payout_status = ANY (ARRAY['pending'::text, 'held'::text, 'released'::text, 'refunded'::text])),
  available_for_payout_at timestamp with time zone,
  commission_rate_snapshot numeric NOT NULL DEFAULT 0 CHECK (commission_rate_snapshot >= 0::numeric AND commission_rate_snapshot <= 1::numeric) NOT VALI),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT order_items_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
);
CREATE TABLE public.user_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  product_id bigint NOT NULL,
  order_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_products_pkey PRIMARY KEY (id),
  CONSTRAINT user_products_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT user_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT user_products_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  midtrans_transaction_id text,
  payment_type text,
  gross_amount integer,
  transaction_status text,
  fraud_status text,
  raw_response jsonb,
  created_at timestamp with time zone DEFAULT now(),
  provider text,
  provider_invoice_id text UNIQUE,
  payment_method text,
  status text,
  paid_at timestamp with time zone,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.download_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  product_id bigint NOT NULL,
  downloaded_at timestamp with time zone DEFAULT now(),
  ip_address inet,
  user_agent text,
  CONSTRAINT download_logs_pkey PRIMARY KEY (id),
  CONSTRAINT download_logs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT download_logs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount integer NOT NULL,
  max_usage integer DEFAULT 1,
  used_count integer DEFAULT 0,
  expired_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  version text DEFAULT '1.0.0'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_files_pkey PRIMARY KEY (id),
  CONSTRAINT product_files_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.coupon_usages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  order_id uuid NOT NULL,
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupon_usages_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_usages_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id),
  CONSTRAINT coupon_usages_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT coupon_usages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.sellers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  store_name text NOT NULL,
  store_slug text NOT NULL UNIQUE,
  store_description text,
  bank_account text,
  bank_name text,
  commission_rate numeric NOT NULL DEFAULT 0.10 CHECK (commission_rate >= 0::numeric AND commission_rate <= 1::numeric) NOT VALI),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text, 'rejected'::text])),
  created_at timestamp with time zone DEFAULT now(),
  rejection_reason text,
  store_image_url text,
  payout_recipient_type text NOT NULL DEFAULT 'INDIVIDUAL'::text CHECK (payout_recipient_type = ANY (ARRAY['INDIVIDUAL'::text, 'BUSINESS'::text])),
  payout_account_holder_name text,
  payout_given_name text,
  payout_surname text,
  payout_business_name text,
  payout_routing_type text CHECK (payout_routing_type IS NULL OR (payout_routing_type = ANY (ARRAY['SWIFT'::text, 'IBAN'::text, 'SORT_CODE'::text, 'ABA'::text, 'BSB'::text, 'WALLET'::text, 'CLABE'::text, 'MOBILE_NO'::text, 'BUSINESS_REG_NO'::text, 'NATIONAL_ID'::text]))),
  payout_routing_value text,
  payout_address_line_1 text,
  payout_city text,
  payout_province text,
  payout_postal_code text,
  CONSTRAINT sellers_pkey PRIMARY KEY (id),
  CONSTRAINT sellers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.seller_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0) NOT VALI),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'failed'::text, 'reversed'::text])),
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  paid_at timestamp with time zone,
  reference_no text,
  created_at timestamp with time zone DEFAULT now(),
  gross_amount integer NOT NULL CHECK (gross_amount >= 0) NOT VALI),
  adjustment_amount integer NOT NULL DEFAULT 0,
  bank_name_snapshot text,
  bank_account_snapshot text,
  provider text,
  provider_payout_id text,
  provider_reference_id text,
  provider_status text,
  provider_failure_code text,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_submitted_at timestamp with time zone,
  provider_updated_at timestamp with time zone,
  provider_submission_attempts integer NOT NULL DEFAULT 0 CHECK (provider_submission_attempts >= 0),
  reversed_at timestamp with time zone,
  recipient_type_snapshot text,
  account_holder_name_snapshot text,
  recipient_given_name_snapshot text,
  recipient_surname_snapshot text,
  recipient_business_name_snapshot text,
  routing_type_snapshot text,
  routing_value_snapshot text,
  address_line_1_snapshot text,
  city_snapshot text,
  province_snapshot text,
  postal_code_snapshot text,
  CONSTRAINT seller_payouts_pkey PRIMARY KEY (id),
  CONSTRAINT seller_payouts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
);
CREATE TABLE public.seller_payout_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL,
  order_item_id bigint NOT NULL,
  CONSTRAINT seller_payout_items_pkey PRIMARY KEY (id),
  CONSTRAINT seller_payout_items_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.seller_payouts(id),
  CONSTRAINT seller_payout_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id)
);
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_profile_id uuid,
  actor_name text,
  actor_type text NOT NULL DEFAULT 'system'::text CHECK (actor_type = ANY (ARRAY['buyer'::text, 'seller'::text, 'admin'::text, 'system'::text])),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.welcome_content (
  section text NOT NULL CHECK (section = ANY (ARRAY['navbar'::text, 'hero'::text, 'features'::text, 'about'::text, 'testimonials'::text, 'cta'::text, 'footer'::text])),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'::text),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT welcome_content_pkey PRIMARY KEY (section),
  CONSTRAINT welcome_content_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.payment_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  order_number text,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  provider_status text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payment_refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'xendit'::text,
  provider_refund_id text NOT NULL,
  provider_payment_id text,
  payment_id uuid,
  order_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text])),
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_refunds_pkey PRIMARY KEY (id),
  CONSTRAINT payment_refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id),
  CONSTRAINT payment_refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.seller_balance_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  order_item_id bigint,
  amount integer NOT NULL CHECK (amount <> 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'applied'::text, 'cancelled'::text])),
  payout_id uuid,
  source_payout_id uuid,
  reference_no text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  applied_at timestamp with time zone,
  CONSTRAINT seller_balance_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT seller_balance_adjustments_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id),
  CONSTRAINT seller_balance_adjustments_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id),
  CONSTRAINT seller_balance_adjustments_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.seller_payouts(id),
  CONSTRAINT seller_balance_adjustments_source_payout_id_fkey FOREIGN KEY (source_payout_id) REFERENCES public.seller_payouts(id)
);
CREATE TABLE public.api_rate_limits (
  key text NOT NULL,
  window_started_at timestamp with time zone NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  CONSTRAINT api_rate_limits_pkey PRIMARY KEY (key)
);
CREATE TABLE public.product_specs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id bigint NOT NULL,
  spec_name text NOT NULL CHECK (char_length(btrim(spec_name)) >= 1 AND char_length(btrim(spec_name)) <= 80),
  spec_value text NOT NULL CHECK (char_length(btrim(spec_value)) >= 1 AND char_length(btrim(spec_value)) <= 500),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order <= 9999),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_specs_pkey PRIMARY KEY (id),
  CONSTRAINT product_specs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.xendit_payout_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_name text NOT NULL,
  provider_payout_id text,
  provider_reference_id text NOT NULL,
  provider_status text NOT NULL,
  payout_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT xendit_payout_events_pkey PRIMARY KEY (id),
  CONSTRAINT xendit_payout_events_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.seller_payouts(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  guest_session_hash text,
  guest_expires_at timestamp with time zone,
  title text CHECK (title IS NULL OR char_length(btrim(title)) >= 1 AND char_length(btrim(title)) <= 160),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'escalated'::text, 'resolved'::text, 'closed'::text])),
  channel text NOT NULL DEFAULT 'web'::text CHECK (channel ~ '^[a-z][a-z0-9_-]{1,31}$'::text),
  language text NOT NULL DEFAULT 'en'::text CHECK (language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$'::text),
  last_message_at timestamp with time zone,
  resolved_at timestamp with time zone,
  closed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text, 'tool'::text])),
  sender_type text NOT NULL CHECK (sender_type = ANY (ARRAY['customer'::text, 'ai'::text, 'human_agent'::text, 'system'::text, 'tool'::text])),
  author_profile_id uuid,
  visibility text NOT NULL DEFAULT 'customer'::text CHECK (visibility = ANY (ARRAY['customer'::text, 'internal'::text])),
  status text NOT NULL DEFAULT 'completed'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'blocked'::text])),
  content text NOT NULL DEFAULT ''::text,
  client_message_id uuid,
  model text,
  finish_reason text,
  provider_response_id text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  latency_ms integer,
  estimated_cost_microusd bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'::text),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reply_to_message_id uuid,
  generation_claim_token uuid,
  generation_started_at timestamp with time zone,
  generation_attempts integer NOT NULL DEFAULT 0 CHECK (generation_attempts >= 0 AND generation_attempts <= 10),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_author_profile_id_fkey FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT messages_reply_to_conversation_fkey FOREIGN KEY (reply_to_message_id) REFERENCES public.messages(id),
  CONSTRAINT messages_reply_to_conversation_fkey FOREIGN KEY (conversation_id) REFERENCES public.messages(conversation_id)
);
CREATE TABLE public.kb_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text AND char_length(slug) <= 160),
  title text NOT NULL CHECK (char_length(btrim(title)) >= 1 AND char_length(btrim(title)) <= 240),
  excerpt text CHECK (excerpt IS NULL OR char_length(excerpt) <= 500),
  content text NOT NULL CHECK (char_length(btrim(content)) >= 1 AND char_length(btrim(content)) <= 100000),
  source_type text NOT NULL DEFAULT 'faq'::text CHECK (source_type = ANY (ARRAY['faq'::text, 'policy'::text, 'guide'::text, 'other'::text])),
  source_reference text,
  category text,
  tags ARRAY NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  embedding USER-DEFINED,
  embedding_model text,
  content_hash text,
  embedded_at timestamp with time zone,
  published_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kb_articles_pkey PRIMARY KEY (id),
  CONSTRAINT kb_articles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT kb_articles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.chat_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  message_id uuid,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 2000),
  tags ARRAY NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT chat_feedback_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT chat_feedback_message_conversation_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT chat_feedback_message_conversation_fkey FOREIGN KEY (conversation_id) REFERENCES public.messages(conversation_id)
);
CREATE TABLE public.escalations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  requested_by text NOT NULL DEFAULT 'user'::text CHECK (requested_by = ANY (ARRAY['user'::text, 'ai'::text, 'admin'::text])),
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 1 AND char_length(btrim(reason)) <= 2000),
  summary text CHECK (summary IS NULL OR char_length(summary) <= 5000),
  priority text NOT NULL DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'assigned'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])),
  assigned_to uuid,
  resolved_by uuid,
  assigned_at timestamp with time zone,
  resolved_at timestamp with time zone,
  closed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT escalations_pkey PRIMARY KEY (id),
  CONSTRAINT escalations_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT escalations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id),
  CONSTRAINT escalations_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.ai_interaction_states (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  assistant_message_id uuid NOT NULL UNIQUE,
  provider_response_id text,
  model text NOT NULL CHECK (char_length(btrim(model)) >= 1 AND char_length(btrim(model)) <= 120),
  provider_steps jsonb NOT NULL CHECK (jsonb_typeof(provider_steps) = 'array'::text AND jsonb_array_length(provider_steps) >= 1 AND jsonb_array_length(provider_steps) <= 64 AND octet_length(provider_steps::text) <= 262144),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_interaction_states_pkey PRIMARY KEY (id),
  CONSTRAINT ai_interaction_states_message_conversation_fkey FOREIGN KEY (assistant_message_id) REFERENCES public.messages(id),
  CONSTRAINT ai_interaction_states_message_conversation_fkey FOREIGN KEY (conversation_id) REFERENCES public.messages(conversation_id)
);
CREATE TABLE public.kb_article_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0 AND chunk_index <= 127),
  content text NOT NULL CHECK (char_length(btrim(content)) >= 1 AND char_length(btrim(content)) <= 16000),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'::text),
  embedding USER-DEFINED NOT NULL,
  embedding_model text NOT NULL CHECK (char_length(btrim(embedding_model)) >= 1 AND char_length(btrim(embedding_model)) <= 160),
  embedded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kb_article_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT kb_article_chunks_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.kb_articles(id)
);
CREATE TABLE public.product_embeddings (
  product_id bigint NOT NULL,
  source_text text NOT NULL CHECK (char_length(btrim(source_text)) >= 1 AND char_length(btrim(source_text)) <= 30000),
  source_version bigint NOT NULL DEFAULT 1 CHECK (source_version > 0),
  embedding USER-DEFINED,
  embedding_model text,
  content_hash text,
  embedded_source_version bigint,
  embedded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_embeddings_pkey PRIMARY KEY (product_id),
  CONSTRAINT product_embeddings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.home_carousel_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_type text NOT NULL DEFAULT 'promo'::text CHECK (content_type = ANY (ARRAY['promo'::text, 'news'::text])),
  badge text NOT NULL DEFAULT ''::text CHECK (char_length(badge) <= 60),
  title text NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 120),
  description text NOT NULL DEFAULT ''::text CHECK (char_length(description) <= 320),
  image_path text CHECK (image_path IS NULL OR char_length(image_path) <= 500),
  button_label text NOT NULL DEFAULT 'Learn More'::text CHECK (char_length(button_label) >= 1 AND char_length(button_label) <= 40),
  link_url text NOT NULL DEFAULT '/products'::text CHECK (link_url ~ '^/[^/]'::text OR link_url ~ '^https://'::text),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT home_carousel_items_pkey PRIMARY KEY (id),
  CONSTRAINT home_carousel_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT home_carousel_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);