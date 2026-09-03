-- Buyer-to-seller messaging. This is intentionally separate from the AI
-- customer-service conversations and messages tables.
-- Date: 2026-09-03

BEGIN;

CREATE TABLE public.buyer_seller_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  product_id bigint,
  order_id uuid,
  status text NOT NULL DEFAULT 'open'
    CHECK (status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text])),
  last_message_at timestamp with time zone,
  buyer_unread_count integer NOT NULL DEFAULT 0 CHECK (buyer_unread_count >= 0),
  seller_unread_count integer NOT NULL DEFAULT 0 CHECK (seller_unread_count >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buyer_seller_threads_buyer_id_fkey
    FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT buyer_seller_threads_seller_id_fkey
    FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE,
  CONSTRAINT buyer_seller_threads_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL,
  CONSTRAINT buyer_seller_threads_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL
);

-- No UNIQUE(buyer_id, seller_id, product_id) is added: whether a buyer may
-- open multiple conversations is a product decision, not a schema assumption.
CREATE INDEX buyer_seller_threads_buyer_activity_idx
  ON public.buyer_seller_threads (buyer_id, last_message_at DESC NULLS LAST, created_at DESC);
CREATE INDEX buyer_seller_threads_seller_activity_idx
  ON public.buyer_seller_threads (seller_id, last_message_at DESC NULLS LAST, created_at DESC);

CREATE TABLE public.buyer_seller_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_profile_id uuid NOT NULL,
  content text NOT NULL
    CHECK (char_length(btrim(content)) BETWEEN 1 AND 5000),
  attachment_url text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buyer_seller_messages_thread_id_fkey
    FOREIGN KEY (thread_id) REFERENCES public.buyer_seller_threads(id) ON DELETE CASCADE,
  CONSTRAINT buyer_seller_messages_sender_profile_id_fkey
    FOREIGN KEY (sender_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX buyer_seller_messages_thread_created_idx
  ON public.buyer_seller_messages (thread_id, created_at, id);
CREATE INDEX buyer_seller_messages_sender_rate_idx
  ON public.buyer_seller_messages (sender_profile_id, created_at DESC);

CREATE TABLE public.buyer_seller_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 2000),
  status text NOT NULL DEFAULT 'open'
    CHECK (status = ANY (ARRAY['open'::text, 'reviewed'::text, 'dismissed'::text])),
  reviewed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buyer_seller_reports_thread_id_fkey
    FOREIGN KEY (thread_id) REFERENCES public.buyer_seller_threads(id) ON DELETE CASCADE,
  CONSTRAINT buyer_seller_reports_reported_by_fkey
    FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT buyer_seller_reports_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX buyer_seller_reports_status_created_idx
  ON public.buyer_seller_reports (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_buyer_seller_thread_participant(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.buyer_seller_threads AS thread
    LEFT JOIN public.sellers AS seller ON seller.id = thread.seller_id
    WHERE thread.id = p_thread_id
      AND (thread.buyer_id = auth.uid() OR seller.profile_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_buyer_seller_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
      OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
      OR NEW.product_id IS DISTINCT FROM OLD.product_id
      OR NEW.order_id IS DISTINCT FROM OLD.order_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Thread participants and context cannot be changed.' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.buyer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the buyer can start this conversation.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sellers
    WHERE id = NEW.seller_id
      AND status = 'approved'
      AND profile_id <> NEW.buyer_id
  ) THEN
    RAISE EXCEPTION 'The selected seller is unavailable.' USING ERRCODE = 'P0002';
  END IF;
  IF NEW.product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = NEW.product_id
      AND seller_id = NEW.seller_id
      AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'The product does not belong to this seller.' USING ERRCODE = '23514';
  END IF;
  IF NEW.order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.orders
    JOIN public.order_items ON order_items.order_id = orders.id
    WHERE orders.id = NEW.order_id
      AND orders.profile_id = NEW.buyer_id
      AND order_items.seller_id = NEW.seller_id
  ) THEN
    RAISE EXCEPTION 'The order does not belong to this buyer and seller.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_buyer_seller_thread
  BEFORE INSERT OR UPDATE ON public.buyer_seller_threads
  FOR EACH ROW EXECUTE FUNCTION public.validate_buyer_seller_thread();

CREATE OR REPLACE FUNCTION public.on_buyer_seller_message_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_thread public.buyer_seller_threads;
  v_seller_profile_id uuid;
BEGIN
  SELECT thread.*
  INTO v_thread
  FROM public.buyer_seller_threads AS thread
  WHERE thread.id = NEW.thread_id
  FOR UPDATE;

  SELECT seller.profile_id
  INTO v_seller_profile_id
  FROM public.sellers AS seller
  WHERE seller.id = v_thread.seller_id;

  IF v_thread.id IS NULL OR v_thread.status <> 'open' THEN
    RAISE EXCEPTION 'This conversation is not open.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.sender_profile_id NOT IN (v_thread.buyer_id, v_seller_profile_id) THEN
    RAISE EXCEPTION 'Message sender is not a participant.' USING ERRCODE = '42501';
  END IF;
  IF (
    SELECT count(*)
    FROM public.buyer_seller_messages
    WHERE sender_profile_id = NEW.sender_profile_id
      AND created_at >= now() - interval '1 minute'
  ) > 20 THEN
    RAISE EXCEPTION 'Message rate limit exceeded.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.buyer_seller_threads
  SET last_message_at = NEW.created_at,
      updated_at = now(),
      buyer_unread_count = CASE
        WHEN NEW.sender_profile_id = v_seller_profile_id THEN buyer_unread_count + 1
        ELSE buyer_unread_count
      END,
      seller_unread_count = CASE
        WHEN NEW.sender_profile_id = v_thread.buyer_id THEN seller_unread_count + 1
        ELSE seller_unread_count
      END
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_buyer_seller_message_inserted
  AFTER INSERT ON public.buyer_seller_messages
  FOR EACH ROW EXECUTE FUNCTION public.on_buyer_seller_message_inserted();

CREATE OR REPLACE FUNCTION public.mark_buyer_seller_thread_read(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_thread public.buyer_seller_threads;
  v_seller_profile_id uuid;
BEGIN
  SELECT thread.*
  INTO v_thread
  FROM public.buyer_seller_threads AS thread
  WHERE thread.id = p_thread_id
  FOR UPDATE;

  SELECT seller.profile_id
  INTO v_seller_profile_id
  FROM public.sellers AS seller
  WHERE seller.id = v_thread.seller_id;

  IF v_thread.id IS NULL OR auth.uid() NOT IN (v_thread.buyer_id, v_seller_profile_id) THEN
    RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.buyer_seller_messages
  SET is_read = true, read_at = now()
  WHERE thread_id = p_thread_id
    AND sender_profile_id <> auth.uid()
    AND is_read = false;

  UPDATE public.buyer_seller_threads
  SET buyer_unread_count = CASE WHEN auth.uid() = v_thread.buyer_id THEN 0 ELSE buyer_unread_count END,
      seller_unread_count = CASE WHEN auth.uid() = v_seller_profile_id THEN 0 ELSE seller_unread_count END,
      updated_at = now()
  WHERE id = p_thread_id;
END;
$$;

ALTER TABLE public.buyer_seller_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_seller_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_seller_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can view threads"
  ON public.buyer_seller_threads FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = buyer_seller_threads.seller_id
      AND sellers.profile_id = auth.uid()
  ));

CREATE POLICY "Buyers can start seller threads"
  ON public.buyer_seller_threads FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Thread participants can update thread status"
  ON public.buyer_seller_threads FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = buyer_seller_threads.seller_id
      AND sellers.profile_id = auth.uid()
  ))
  WITH CHECK (buyer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = buyer_seller_threads.seller_id
      AND sellers.profile_id = auth.uid()
  ));

CREATE POLICY "Thread participants can view messages"
  ON public.buyer_seller_messages FOR SELECT TO authenticated
  USING (public.is_buyer_seller_thread_participant(thread_id));

CREATE POLICY "Thread participants can send messages"
  ON public.buyer_seller_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_profile_id = auth.uid()
    AND public.is_buyer_seller_thread_participant(thread_id)
  );

CREATE POLICY "Thread participants can create reports"
  ON public.buyer_seller_reports FOR INSERT TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
    AND public.is_buyer_seller_thread_participant(thread_id)
  );

CREATE POLICY "Platform admins can view reports"
  ON public.buyer_seller_reports FOR SELECT TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can update reports"
  ON public.buyer_seller_reports FOR UPDATE TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

GRANT SELECT, INSERT ON public.buyer_seller_threads TO authenticated;
GRANT UPDATE (status) ON public.buyer_seller_threads TO authenticated;
GRANT SELECT, INSERT ON public.buyer_seller_messages TO authenticated;
GRANT INSERT ON public.buyer_seller_reports TO authenticated;
GRANT SELECT, UPDATE ON public.buyer_seller_reports TO authenticated;

REVOKE ALL ON FUNCTION public.is_buyer_seller_thread_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_buyer_seller_thread_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_buyer_seller_thread_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_buyer_seller_thread_read(uuid) TO authenticated;

-- Realtime subscriptions still obey the table RLS policies above.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'buyer_seller_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.buyer_seller_messages;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
