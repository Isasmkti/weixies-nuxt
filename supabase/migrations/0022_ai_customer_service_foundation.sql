-- AI customer service foundation (Gemini + Supabase)
-- Phase 1: pgvector, persisted chat data, ownership, and RLS boundaries.
--
-- Guest chat is intentionally server-mediated. The browser will receive an
-- opaque token in an HttpOnly cookie in Phase 2; only its SHA-256 hash is
-- stored here. No anon role receives direct access to chat tables.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  guest_session_hash text,
  guest_expires_at timestamp with time zone,
  title text,
  status text NOT NULL DEFAULT 'active',
  channel text NOT NULL DEFAULT 'web',
  language text NOT NULL DEFAULT 'en',
  last_message_at timestamp with time zone,
  resolved_at timestamp with time zone,
  closed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT conversations_owner_check CHECK (
    (
      profile_id IS NOT NULL
      AND guest_session_hash IS NULL
      AND guest_expires_at IS NULL
    )
    OR
    (
      profile_id IS NULL
      AND guest_session_hash ~ '^[0-9a-f]{64}$'
      AND guest_expires_at IS NOT NULL
      AND guest_expires_at > created_at
    )
  ),
  CONSTRAINT conversations_title_check CHECK (
    title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 160
  ),
  CONSTRAINT conversations_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'escalated'::text, 'resolved'::text, 'closed'::text])
  ),
  CONSTRAINT conversations_channel_check CHECK (
    channel ~ '^[a-z][a-z0-9_-]{1,31}$'
  ),
  CONSTRAINT conversations_language_check CHECK (
    language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$'
  )
);

CREATE INDEX conversations_profile_updated_at_idx
  ON public.conversations (profile_id, updated_at DESC)
  WHERE profile_id IS NOT NULL;

CREATE INDEX conversations_guest_updated_at_idx
  ON public.conversations (guest_session_hash, updated_at DESC)
  WHERE guest_session_hash IS NOT NULL;

CREATE INDEX conversations_guest_expires_at_idx
  ON public.conversations (guest_expires_at)
  WHERE guest_expires_at IS NOT NULL;

CREATE INDEX conversations_status_updated_at_idx
  ON public.conversations (status, updated_at DESC);

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  role text NOT NULL,
  sender_type text NOT NULL,
  author_profile_id uuid,
  visibility text NOT NULL DEFAULT 'customer',
  status text NOT NULL DEFAULT 'completed',
  content text NOT NULL DEFAULT '',
  client_message_id uuid,
  model text,
  finish_reason text,
  provider_response_id text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  latency_ms integer,
  estimated_cost_microusd bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  CONSTRAINT messages_author_profile_id_fkey
    FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT messages_id_conversation_key UNIQUE (id, conversation_id),
  CONSTRAINT messages_role_check CHECK (
    role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text, 'tool'::text])
  ),
  CONSTRAINT messages_sender_type_check CHECK (
    sender_type = ANY (
      ARRAY['customer'::text, 'ai'::text, 'human_agent'::text, 'system'::text, 'tool'::text]
    )
  ),
  CONSTRAINT messages_role_sender_check CHECK (
    (role = 'user' AND sender_type = 'customer')
    OR (role = 'assistant' AND sender_type = ANY (ARRAY['ai'::text, 'human_agent'::text]))
    OR (role = 'system' AND sender_type = 'system')
    OR (role = 'tool' AND sender_type = 'tool')
  ),
  CONSTRAINT messages_visibility_check CHECK (
    visibility = ANY (ARRAY['customer'::text, 'internal'::text])
  ),
  CONSTRAINT messages_visibility_role_check CHECK (
    (role = 'user' AND visibility = 'customer')
    OR role = 'assistant'
    OR (role = ANY (ARRAY['system'::text, 'tool'::text]) AND visibility = 'internal')
  ),
  CONSTRAINT messages_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'blocked'::text])
  ),
  CONSTRAINT messages_content_check CHECK (
    char_length(content) <= 30000
    AND (NULLIF(btrim(content), '') IS NOT NULL OR metadata <> '{}'::jsonb)
  ),
  CONSTRAINT messages_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT messages_usage_check CHECK (
    (input_tokens IS NULL OR input_tokens >= 0)
    AND (output_tokens IS NULL OR output_tokens >= 0)
    AND (total_tokens IS NULL OR total_tokens >= 0)
    AND (latency_ms IS NULL OR latency_ms >= 0)
    AND (estimated_cost_microusd IS NULL OR estimated_cost_microusd >= 0)
  )
);

CREATE INDEX messages_conversation_created_at_idx
  ON public.messages (conversation_id, created_at, id);

CREATE UNIQUE INDEX messages_client_id_uidx
  ON public.messages (conversation_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX messages_provider_response_id_idx
  ON public.messages (provider_response_id)
  WHERE provider_response_id IS NOT NULL;

CREATE TABLE public.kb_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL,
  source_type text NOT NULL DEFAULT 'faq',
  source_reference text,
  category text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'draft',
  embedding extensions.vector(768),
  embedding_model text,
  content_hash text,
  embedded_at timestamp with time zone,
  published_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kb_articles_pkey PRIMARY KEY (id),
  CONSTRAINT kb_articles_slug_key UNIQUE (slug),
  CONSTRAINT kb_articles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT kb_articles_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT kb_articles_slug_check CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 160
  ),
  CONSTRAINT kb_articles_title_check CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 240
  ),
  CONSTRAINT kb_articles_excerpt_check CHECK (
    excerpt IS NULL OR char_length(excerpt) <= 500
  ),
  CONSTRAINT kb_articles_content_check CHECK (
    char_length(btrim(content)) BETWEEN 1 AND 100000
  ),
  CONSTRAINT kb_articles_source_type_check CHECK (
    source_type = ANY (ARRAY['faq'::text, 'policy'::text, 'guide'::text, 'other'::text])
  ),
  CONSTRAINT kb_articles_status_check CHECK (
    status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])
  ),
  CONSTRAINT kb_articles_embedding_check CHECK (
    (
      embedding IS NULL
      AND embedding_model IS NULL
      AND content_hash IS NULL
      AND embedded_at IS NULL
    )
    OR
    (
      embedding IS NOT NULL
      AND NULLIF(btrim(embedding_model), '') IS NOT NULL
      AND content_hash ~ '^[0-9a-f]{64}$'
      AND embedded_at IS NOT NULL
    )
  )
);

CREATE INDEX kb_articles_status_updated_at_idx
  ON public.kb_articles (status, updated_at DESC);

CREATE INDEX kb_articles_tags_gin_idx
  ON public.kb_articles USING gin (tags);

CREATE INDEX kb_articles_embedding_hnsw_idx
  ON public.kb_articles
  USING hnsw (embedding extensions.vector_cosine_ops)
  WHERE status = 'published' AND embedding IS NOT NULL;

CREATE TABLE public.chat_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  message_id uuid,
  rating smallint NOT NULL,
  comment text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT chat_feedback_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  CONSTRAINT chat_feedback_message_conversation_fkey
    FOREIGN KEY (message_id, conversation_id)
    REFERENCES public.messages(id, conversation_id) ON DELETE CASCADE,
  CONSTRAINT chat_feedback_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT chat_feedback_comment_check CHECK (
    comment IS NULL OR char_length(comment) <= 2000
  )
);

CREATE UNIQUE INDEX chat_feedback_message_uidx
  ON public.chat_feedback (message_id)
  WHERE message_id IS NOT NULL;

CREATE UNIQUE INDEX chat_feedback_conversation_uidx
  ON public.chat_feedback (conversation_id)
  WHERE message_id IS NULL;

CREATE INDEX chat_feedback_created_at_idx
  ON public.chat_feedback (created_at DESC);

CREATE TABLE public.escalations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  requested_by text NOT NULL DEFAULT 'user',
  reason text NOT NULL,
  summary text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  resolved_by uuid,
  assigned_at timestamp with time zone,
  resolved_at timestamp with time zone,
  closed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT escalations_pkey PRIMARY KEY (id),
  CONSTRAINT escalations_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  CONSTRAINT escalations_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT escalations_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT escalations_requested_by_check CHECK (
    requested_by = ANY (ARRAY['user'::text, 'ai'::text, 'admin'::text])
  ),
  CONSTRAINT escalations_reason_check CHECK (
    char_length(btrim(reason)) BETWEEN 1 AND 2000
  ),
  CONSTRAINT escalations_summary_check CHECK (
    summary IS NULL OR char_length(summary) <= 5000
  ),
  CONSTRAINT escalations_priority_check CHECK (
    priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])
  ),
  CONSTRAINT escalations_status_check CHECK (
    status = ANY (
      ARRAY['open'::text, 'assigned'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text]
    )
  )
);

CREATE UNIQUE INDEX escalations_one_active_per_conversation_uidx
  ON public.escalations (conversation_id)
  WHERE status = ANY (ARRAY['open'::text, 'assigned'::text, 'in_progress'::text]);

CREATE INDEX escalations_status_priority_created_at_idx
  ON public.escalations (status, priority, created_at DESC);

CREATE INDEX escalations_assigned_to_status_idx
  ON public.escalations (assigned_to, status, updated_at DESC)
  WHERE assigned_to IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_ai_cs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_ai_kb_embedding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.embedding := NULL;
    NEW.embedding_model := NULL;
    NEW.content_hash := NULL;
    NEW.embedded_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_ai_conversation_message_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = GREATEST(
        COALESCE(last_message_at, NEW.created_at),
        NEW.created_at
      ),
      updated_at = GREATEST(updated_at, NEW.created_at)
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_ai_chat_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.message_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.messages
       WHERE messages.id = NEW.message_id
         AND messages.conversation_id = NEW.conversation_id
         AND messages.role = 'assistant'
         AND messages.visibility = 'customer'
     ) THEN
    RAISE EXCEPTION 'Feedback can only target a customer-visible assistant message.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_ai_cs_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invalidate_ai_kb_embedding() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_ai_conversation_message_timestamp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_ai_chat_feedback() FROM PUBLIC;

CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_cs_updated_at();

CREATE TRIGGER kb_articles_invalidate_embedding
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_ai_kb_embedding();

CREATE TRIGGER kb_articles_set_updated_at
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_cs_updated_at();

CREATE TRIGGER chat_feedback_validate_message
  BEFORE INSERT OR UPDATE ON public.chat_feedback
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_chat_feedback();

CREATE TRIGGER chat_feedback_set_updated_at
  BEFORE UPDATE ON public.chat_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_cs_updated_at();

CREATE TRIGGER escalations_set_updated_at
  BEFORE UPDATE ON public.escalations
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_cs_updated_at();

CREATE TRIGGER messages_sync_conversation_timestamp
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_ai_conversation_message_timestamp();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.kb_articles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.chat_feedback FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.escalations FROM PUBLIC, anon, authenticated;

CREATE POLICY "Users can read own AI conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Platform admins can read AI conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can update AI conversations"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage AI conversations"
  ON public.conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own customer-visible AI messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'customer'
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.profile_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can read AI messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage AI messages"
  ON public.messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Platform admins can manage AI knowledge base"
  ON public.kb_articles
  FOR ALL
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage AI knowledge base"
  ON public.kb_articles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own AI chat feedback"
  ON public.chat_feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = chat_feedback.conversation_id
        AND conversations.profile_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can read AI chat feedback"
  ON public.chat_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage AI chat feedback"
  ON public.chat_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own AI escalations"
  ON public.escalations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = escalations.conversation_id
        AND conversations.profile_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can read AI escalations"
  ON public.escalations
  FOR SELECT
  TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can update AI escalations"
  ON public.escalations
  FOR UPDATE
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage AI escalations"
  ON public.escalations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT SELECT ON public.chat_feedback TO authenticated;
GRANT SELECT, UPDATE ON public.escalations TO authenticated;

GRANT ALL PRIVILEGES ON public.conversations TO service_role;
GRANT ALL PRIVILEGES ON public.messages TO service_role;
GRANT ALL PRIVILEGES ON public.kb_articles TO service_role;
GRANT ALL PRIVILEGES ON public.chat_feedback TO service_role;
GRANT ALL PRIVILEGES ON public.escalations TO service_role;

COMMENT ON COLUMN public.conversations.guest_session_hash IS
  'Lowercase SHA-256 hash of a high-entropy token held only in an HttpOnly cookie.';
COMMENT ON COLUMN public.messages.visibility IS
  'Only customer rows may be returned to conversation owners; prompts and tool data remain internal.';
COMMENT ON COLUMN public.messages.provider_response_id IS
  'Gemini interaction or response identifier used for operational trace correlation.';
COMMENT ON COLUMN public.kb_articles.embedding IS
  '768-dimensional Gemini embedding. Phase 3 retrieval must filter by published status and embedding model.';

COMMIT;
