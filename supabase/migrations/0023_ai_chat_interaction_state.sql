-- AI customer service Phase 2: private Gemini stateless conversation state.
--
-- Interactions API requests use store=false. Google requires all model steps
-- from earlier turns to be replayed exactly, including any signed thought or
-- tool steps. They are isolated here rather than placed on customer-readable
-- message rows. Only the service role can access this table.

BEGIN;

ALTER TABLE public.messages
  ADD COLUMN reply_to_message_id uuid,
  ADD COLUMN generation_claim_token uuid,
  ADD COLUMN generation_started_at timestamp with time zone,
  ADD COLUMN generation_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_reply_to_conversation_fkey
    FOREIGN KEY (reply_to_message_id, conversation_id)
    REFERENCES public.messages(id, conversation_id) ON DELETE CASCADE,
  ADD CONSTRAINT messages_generation_attempts_check CHECK (
    generation_attempts BETWEEN 0 AND 10
  ),
  ADD CONSTRAINT messages_ai_generation_state_check CHECK (
    (
      reply_to_message_id IS NULL
      AND generation_claim_token IS NULL
      AND generation_started_at IS NULL
      AND generation_attempts = 0
    )
    OR
    (
      role = 'assistant'
      AND sender_type = 'ai'
      AND reply_to_message_id IS NOT NULL
      AND generation_started_at IS NOT NULL
      AND generation_attempts BETWEEN 1 AND 10
      AND (
        (
          status = 'pending'
          AND visibility = 'internal'
          AND generation_claim_token IS NOT NULL
        )
        OR
        (
          status = ANY (ARRAY['completed'::text, 'failed'::text, 'blocked'::text])
          AND visibility = 'customer'
          AND generation_claim_token IS NULL
        )
      )
    )
  );

CREATE UNIQUE INDEX messages_one_ai_reply_per_user_message_uidx
  ON public.messages (conversation_id, reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

CREATE INDEX messages_pending_generation_started_at_idx
  ON public.messages (generation_started_at)
  WHERE status = 'pending' AND generation_claim_token IS NOT NULL;

CREATE TABLE public.ai_interaction_states (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  assistant_message_id uuid NOT NULL,
  provider_response_id text,
  model text NOT NULL,
  provider_steps jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_interaction_states_pkey PRIMARY KEY (id),
  CONSTRAINT ai_interaction_states_assistant_message_key UNIQUE (assistant_message_id),
  CONSTRAINT ai_interaction_states_message_conversation_fkey
    FOREIGN KEY (assistant_message_id, conversation_id)
    REFERENCES public.messages(id, conversation_id) ON DELETE CASCADE,
  CONSTRAINT ai_interaction_states_model_check CHECK (
    char_length(btrim(model)) BETWEEN 1 AND 120
  ),
  CONSTRAINT ai_interaction_states_steps_check CHECK (
    jsonb_typeof(provider_steps) = 'array'
    AND jsonb_array_length(provider_steps) BETWEEN 1 AND 64
    AND octet_length(provider_steps::text) <= 262144
  )
);

CREATE INDEX ai_interaction_states_conversation_created_at_idx
  ON public.ai_interaction_states (conversation_id, created_at);

CREATE INDEX ai_interaction_states_provider_response_id_idx
  ON public.ai_interaction_states (provider_response_id)
  WHERE provider_response_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_ai_interaction_state_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.messages
    WHERE messages.id = NEW.assistant_message_id
      AND messages.conversation_id = NEW.conversation_id
      AND messages.role = 'assistant'
      AND messages.sender_type = 'ai'
      AND messages.visibility = 'customer'
      AND messages.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Interaction state requires a completed customer-visible AI response.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_ai_interaction_state_message() FROM PUBLIC;

CREATE TRIGGER ai_interaction_states_validate_message
  BEFORE INSERT OR UPDATE ON public.ai_interaction_states
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_interaction_state_message();

ALTER TABLE public.ai_interaction_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_interaction_states FROM PUBLIC, anon, authenticated;

CREATE POLICY "Service role can manage private AI interaction state"
  ON public.ai_interaction_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL PRIVILEGES ON public.ai_interaction_states TO service_role;

COMMENT ON TABLE public.ai_interaction_states IS
  'Private provider steps replayed for Gemini stateless chat; never return these rows to clients.';
COMMENT ON COLUMN public.messages.generation_claim_token IS
  'Short-lived worker lease that prevents duplicate Gemini calls for one customer message.';

COMMIT;
