-- AI customer service: chunked knowledge-base and product semantic retrieval.
-- Phase 3 keeps all vectors and indexing primitives behind the service role.

BEGIN;

-- ---------------------------------------------------------------------------
-- Chunked knowledge-base index
-- ---------------------------------------------------------------------------

CREATE TABLE public.kb_article_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  content_hash text NOT NULL,
  embedding extensions.vector(768) NOT NULL,
  embedding_model text NOT NULL,
  embedded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kb_article_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT kb_article_chunks_article_id_fkey
    FOREIGN KEY (article_id)
    REFERENCES public.kb_articles(id)
    ON DELETE CASCADE,
  CONSTRAINT kb_article_chunks_article_index_key
    UNIQUE (article_id, chunk_index),
  CONSTRAINT kb_article_chunks_index_check CHECK (
    chunk_index BETWEEN 0 AND 127
  ),
  CONSTRAINT kb_article_chunks_content_check CHECK (
    char_length(btrim(content)) BETWEEN 1 AND 16000
  ),
  CONSTRAINT kb_article_chunks_content_hash_check CHECK (
    content_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT kb_article_chunks_embedding_model_check CHECK (
    char_length(btrim(embedding_model)) BETWEEN 1 AND 160
  )
);

CREATE INDEX kb_article_chunks_article_idx
  ON public.kb_article_chunks (article_id, chunk_index);

CREATE INDEX kb_article_chunks_embedding_model_idx
  ON public.kb_article_chunks (embedding_model);

CREATE INDEX kb_article_chunks_embedding_hnsw_idx
  ON public.kb_article_chunks
  USING hnsw (embedding extensions.vector_cosine_ops);

-- Lets the indexing worker find published records that have not yet been
-- indexed (or were invalidated by an article edit) without scanning the table.
CREATE INDEX kb_articles_pending_embedding_idx
  ON public.kb_articles (updated_at, id)
  WHERE status = 'published' AND embedding IS NULL;

CREATE FUNCTION public.invalidate_ai_kb_chunks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.content IS DISTINCT FROM OLD.content THEN
    DELETE FROM public.kb_article_chunks
    WHERE article_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.invalidate_ai_kb_chunks() FROM PUBLIC;

CREATE TRIGGER kb_articles_invalidate_chunks
  AFTER UPDATE OF title, content ON public.kb_articles
  FOR EACH ROW
  WHEN (
    OLD.title IS DISTINCT FROM NEW.title
    OR OLD.content IS DISTINCT FROM NEW.content
  )
  EXECUTE FUNCTION public.invalidate_ai_kb_chunks();

-- Replace the complete article index in one transaction. The optimistic
-- timestamp prevents an embedding generated for old content from being saved
-- after an admin edit. p_chunks is an ordered JSON array. Each item must be:
-- { "content": "...", "content_hash": "sha256", "embedding": [768 numbers] }
CREATE FUNCTION public.replace_ai_kb_index(
  p_article_id uuid,
  p_expected_updated_at timestamp with time zone,
  p_embedding_model text,
  p_content_hash text,
  p_centroid_embedding extensions.vector(768),
  p_chunks jsonb,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_article_updated_at timestamp with time zone;
  v_article_status text;
  v_chunk_count integer;
BEGIN
  IF p_article_id IS NULL
     OR p_expected_updated_at IS NULL
     OR p_centroid_embedding IS NULL THEN
    RAISE EXCEPTION 'Article, expected timestamp, and centroid embedding are required.'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(p_embedding_model), '') IS NULL
     OR char_length(btrim(p_embedding_model)) > 160 THEN
    RAISE EXCEPTION 'A valid embedding model is required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_content_hash IS NULL
     OR p_content_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'A lowercase SHA-256 article hash is required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_actor_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS actor
    WHERE actor.id = p_actor_profile_id
      AND actor.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'A valid platform-admin actor is required.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_chunks) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Knowledge-base chunks must be a JSON array.'
      USING ERRCODE = '22023';
  END IF;

  v_chunk_count := jsonb_array_length(p_chunks);
  IF v_chunk_count < 1 OR v_chunk_count > 128 THEN
    RAISE EXCEPTION 'A knowledge-base article requires between 1 and 128 chunks.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_chunks) AS source(chunk)
    WHERE jsonb_typeof(chunk) IS DISTINCT FROM 'object'
       OR NULLIF(btrim(chunk->>'content'), '') IS NULL
       OR char_length(btrim(chunk->>'content')) > 16000
       OR COALESCE(chunk->>'content_hash', '') !~ '^[0-9a-f]{64}$'
       OR jsonb_typeof(chunk->'embedding') IS DISTINCT FROM 'array'
       OR jsonb_array_length(chunk->'embedding') <> 768
  ) THEN
    RAISE EXCEPTION 'Every chunk requires bounded content, a SHA-256 hash, and a 768-dimensional embedding.'
      USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT COALESCE(sum(char_length(chunk->>'content')), 0)
    FROM jsonb_array_elements(p_chunks) AS source(chunk)
  ) > 200000 THEN
    RAISE EXCEPTION 'Combined knowledge-base chunk content is too large.'
      USING ERRCODE = '22023';
  END IF;

  SELECT article.updated_at, article.status
  INTO v_article_updated_at, v_article_status
  FROM public.kb_articles AS article
  WHERE article.id = p_article_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_article_updated_at IS DISTINCT FROM p_expected_updated_at
     OR v_article_status = 'archived' THEN
    RETURN false;
  END IF;

  DELETE FROM public.kb_article_chunks
  WHERE article_id = p_article_id;

  INSERT INTO public.kb_article_chunks (
    article_id,
    chunk_index,
    content,
    content_hash,
    embedding,
    embedding_model,
    embedded_at
  )
  SELECT
    p_article_id,
    (source.ordinality - 1)::integer,
    btrim(source.chunk->>'content'),
    source.chunk->>'content_hash',
    ((source.chunk->'embedding')::text)::extensions.vector(768),
    btrim(p_embedding_model),
    now()
  FROM jsonb_array_elements(p_chunks) WITH ORDINALITY AS source(chunk, ordinality)
  ORDER BY source.ordinality;

  -- kb_articles.embedding is retained as a compact index marker/centroid and
  -- for compatibility with the Phase 1 schema. Retrieval uses the chunks.
  UPDATE public.kb_articles
  SET embedding = p_centroid_embedding,
      embedding_model = btrim(p_embedding_model),
      content_hash = p_content_hash,
      embedded_at = now()
  WHERE id = p_article_id;

  -- auth.uid() is null for the service-role indexing call. Record the admin
  -- validated by the server explicitly so this privileged action remains
  -- attributable in the activity log.
  PERFORM public.record_activity(
    p_actor_profile_id,
    NULL,
    'ai.kb_article.indexed',
    'ai_knowledge',
    p_article_id::text,
    jsonb_build_object(
      'embedding_model', btrim(p_embedding_model),
      'chunk_count', v_chunk_count
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_ai_kb_index(
  uuid,
  timestamp with time zone,
  text,
  text,
  extensions.vector,
  jsonb,
  uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_ai_kb_index(
  uuid,
  timestamp with time zone,
  text,
  text,
  extensions.vector,
  jsonb,
  uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_activity(
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) TO service_role;

CREATE FUNCTION public.match_ai_kb_articles(
  p_query_embedding extensions.vector(768),
  p_embedding_model text,
  p_match_threshold double precision DEFAULT 0.65,
  p_match_count integer DEFAULT 6
)
RETURNS TABLE (
  article_id uuid,
  slug text,
  title text,
  excerpt text,
  source_type text,
  source_reference text,
  category text,
  tags text[],
  chunk_index integer,
  chunk_content text,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_query_embedding IS NULL THEN
    RAISE EXCEPTION 'A query embedding is required.' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(p_embedding_model), '') IS NULL
     OR char_length(btrim(p_embedding_model)) > 160 THEN
    RAISE EXCEPTION 'A valid embedding model is required.' USING ERRCODE = '22023';
  END IF;

  IF p_match_threshold IS NULL
     OR p_match_threshold < 0
     OR p_match_threshold > 1 THEN
    RAISE EXCEPTION 'Match threshold must be between 0 and 1.' USING ERRCODE = '22023';
  END IF;

  IF p_match_count IS NULL OR p_match_count < 1 OR p_match_count > 20 THEN
    RAISE EXCEPTION 'Match count must be between 1 and 20.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    article.id,
    article.slug,
    article.title,
    article.excerpt,
    article.source_type,
    article.source_reference,
    article.category,
    article.tags,
    chunk.chunk_index,
    chunk.content,
    1.0 - (chunk.embedding OPERATOR(extensions.<=>) p_query_embedding)
  FROM public.kb_article_chunks AS chunk
  JOIN public.kb_articles AS article ON article.id = chunk.article_id
  WHERE article.status = 'published'
    AND article.embedding IS NOT NULL
    AND article.embedding_model = btrim(p_embedding_model)
    AND chunk.embedding_model = btrim(p_embedding_model)
    AND 1.0 - (chunk.embedding OPERATOR(extensions.<=>) p_query_embedding) >= p_match_threshold
  ORDER BY chunk.embedding OPERATOR(extensions.<=>) p_query_embedding,
           article.id,
           chunk.chunk_index
  LIMIT p_match_count;
END;
$$;

REVOKE ALL ON FUNCTION public.match_ai_kb_articles(
  extensions.vector,
  text,
  double precision,
  integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_ai_kb_articles(
  extensions.vector,
  text,
  double precision,
  integer
) TO service_role;

-- ---------------------------------------------------------------------------
-- Product embedding sources and index
-- ---------------------------------------------------------------------------

CREATE TABLE public.product_embeddings (
  product_id bigint NOT NULL,
  source_text text NOT NULL,
  source_version bigint NOT NULL DEFAULT 1,
  embedding extensions.vector(768),
  embedding_model text,
  content_hash text,
  embedded_source_version bigint,
  embedded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_embeddings_pkey PRIMARY KEY (product_id),
  CONSTRAINT product_embeddings_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE CASCADE,
  CONSTRAINT product_embeddings_source_text_check CHECK (
    char_length(btrim(source_text)) BETWEEN 1 AND 30000
  ),
  CONSTRAINT product_embeddings_source_version_check CHECK (
    source_version > 0
  ),
  CONSTRAINT product_embeddings_index_state_check CHECK (
    (
      embedding IS NULL
      AND embedding_model IS NULL
      AND content_hash IS NULL
      AND embedded_source_version IS NULL
      AND embedded_at IS NULL
    )
    OR
    (
      embedding IS NOT NULL
      AND char_length(btrim(embedding_model)) BETWEEN 1 AND 160
      AND content_hash ~ '^[0-9a-f]{64}$'
      AND embedded_source_version = source_version
      AND embedded_at IS NOT NULL
    )
  )
);

CREATE INDEX product_embeddings_pending_idx
  ON public.product_embeddings (updated_at, product_id)
  WHERE embedding IS NULL;

CREATE INDEX product_embeddings_model_idx
  ON public.product_embeddings (embedding_model)
  WHERE embedding IS NOT NULL;

CREATE INDEX product_embeddings_embedding_hnsw_idx
  ON public.product_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops)
  WHERE embedding IS NOT NULL;

-- Canonical semantic source contains only publicly displayable, relatively
-- stable product data. Price, file paths, reviews, orders, seller banking, and
-- other dynamic/private data are deliberately excluded.
CREATE FUNCTION public.ai_product_embedding_source(p_product_id bigint)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT left(
    concat_ws(
      E'\n\n',
      'Product name: ' || btrim(product.name),
      'Description:' || E'\n' || btrim(product.description),
      CASE
        WHEN category_list.names IS NOT NULL
          THEN 'Categories: ' || category_list.names
        ELSE NULL
      END,
      CASE
        WHEN specification_list.items IS NOT NULL
          THEN 'Specifications:' || E'\n' || specification_list.items
        ELSE NULL
      END
    ),
    30000
  )
  FROM public.products AS product
  LEFT JOIN LATERAL (
    SELECT string_agg(
      DISTINCT btrim(category.name),
      ', ' ORDER BY btrim(category.name)
    ) FILTER (WHERE NULLIF(btrim(category.name), '') IS NOT NULL) AS names
    FROM public.product_categories AS assignment
    JOIN public.categories AS category ON category.id = assignment.category_id
    WHERE assignment.product_id = product.id
  ) AS category_list ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(
      '- ' || btrim(specification.spec_name) || ': ' || btrim(specification.spec_value),
      E'\n' ORDER BY specification.sort_order, specification.id
    ) AS items
    FROM public.product_specs AS specification
    WHERE specification.product_id = product.id
  ) AS specification_list ON true
  WHERE product.id = p_product_id;
$$;

REVOKE ALL ON FUNCTION public.ai_product_embedding_source(bigint)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.refresh_ai_product_embedding_source(p_product_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source_text text;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  v_source_text := public.ai_product_embedding_source(p_product_id);

  IF v_source_text IS NULL THEN
    DELETE FROM public.product_embeddings
    WHERE product_id = p_product_id;
    RETURN;
  END IF;

  INSERT INTO public.product_embeddings (product_id, source_text)
  VALUES (p_product_id, v_source_text)
  ON CONFLICT (product_id) DO UPDATE
  SET source_text = EXCLUDED.source_text,
      source_version = public.product_embeddings.source_version + 1,
      embedding = NULL,
      embedding_model = NULL,
      content_hash = NULL,
      embedded_source_version = NULL,
      embedded_at = NULL,
      updated_at = now()
  WHERE public.product_embeddings.source_text IS DISTINCT FROM EXCLUDED.source_text;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_ai_product_embedding_source(bigint)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.sync_ai_product_embedding_from_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.refresh_ai_product_embedding_source(NEW.id);
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_ai_product_embedding_from_child()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_ai_product_embedding_source(NEW.product_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_ai_product_embedding_source(OLD.product_id);
    RETURN OLD;
  END IF;

  IF OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    -- Stable ordering reduces deadlock risk when a row is moved between two
    -- products in the same transaction.
    IF OLD.product_id < NEW.product_id THEN
      PERFORM public.refresh_ai_product_embedding_source(OLD.product_id);
      PERFORM public.refresh_ai_product_embedding_source(NEW.product_id);
    ELSE
      PERFORM public.refresh_ai_product_embedding_source(NEW.product_id);
      PERFORM public.refresh_ai_product_embedding_source(OLD.product_id);
    END IF;
  ELSE
    PERFORM public.refresh_ai_product_embedding_source(NEW.product_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_ai_product_embedding_from_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_id bigint;
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    FOR v_product_id IN
      SELECT DISTINCT assignment.product_id
      FROM public.product_categories AS assignment
      WHERE assignment.category_id = NEW.id
        AND assignment.product_id IS NOT NULL
      ORDER BY assignment.product_id
    LOOP
      PERFORM public.refresh_ai_product_embedding_source(v_product_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_ai_product_embedding_from_product() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_ai_product_embedding_from_child() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_ai_product_embedding_from_category() FROM PUBLIC;

CREATE TRIGGER products_create_embedding_source
  AFTER INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ai_product_embedding_from_product();

CREATE TRIGGER products_refresh_embedding_source
  AFTER UPDATE OF name, description ON public.products
  FOR EACH ROW
  WHEN (
    OLD.name IS DISTINCT FROM NEW.name
    OR OLD.description IS DISTINCT FROM NEW.description
  )
  EXECUTE FUNCTION public.sync_ai_product_embedding_from_product();

CREATE TRIGGER product_categories_refresh_embedding_source
  AFTER INSERT OR UPDATE OR DELETE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ai_product_embedding_from_child();

CREATE TRIGGER product_specs_refresh_embedding_source
  AFTER INSERT OR UPDATE OR DELETE ON public.product_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ai_product_embedding_from_child();

CREATE TRIGGER categories_refresh_product_embedding_sources
  AFTER UPDATE OF name ON public.categories
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION public.sync_ai_product_embedding_from_category();

-- Seed deterministic source rows for existing products. They remain pending
-- until the server-side indexing worker stores an embedding.
INSERT INTO public.product_embeddings (product_id, source_text)
SELECT product.id, public.ai_product_embedding_source(product.id)
FROM public.products AS product;

CREATE FUNCTION public.store_ai_product_embedding(
  p_product_id bigint,
  p_expected_source_version bigint,
  p_embedding_model text,
  p_content_hash text,
  p_embedding extensions.vector(768)
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_product_id IS NULL OR p_product_id <= 0
     OR p_expected_source_version IS NULL OR p_expected_source_version <= 0
     OR p_embedding IS NULL THEN
    RAISE EXCEPTION 'Product, source version, and embedding are required.'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(p_embedding_model), '') IS NULL
     OR char_length(btrim(p_embedding_model)) > 160 THEN
    RAISE EXCEPTION 'A valid embedding model is required.' USING ERRCODE = '22023';
  END IF;

  IF p_content_hash IS NULL OR p_content_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'A lowercase SHA-256 product-source hash is required.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.product_embeddings AS product_index
  SET embedding = p_embedding,
      embedding_model = btrim(p_embedding_model),
      content_hash = p_content_hash,
      embedded_source_version = p_expected_source_version,
      embedded_at = now(),
      updated_at = now()
  FROM public.products AS product
  WHERE product_index.product_id = p_product_id
    AND product.id = product_index.product_id
    AND product.status = 'published'
    AND product_index.source_version = p_expected_source_version;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.store_ai_product_embedding(
  bigint,
  bigint,
  text,
  text,
  extensions.vector
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_ai_product_embedding(
  bigint,
  bigint,
  text,
  text,
  extensions.vector
) TO service_role;

CREATE FUNCTION public.match_ai_products(
  p_query_embedding extensions.vector(768),
  p_embedding_model text,
  p_match_threshold double precision DEFAULT 0.60,
  p_match_count integer DEFAULT 6
)
RETURNS TABLE (
  product_id bigint,
  slug text,
  name text,
  description text,
  store_name text,
  store_slug text,
  source_text text,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_query_embedding IS NULL THEN
    RAISE EXCEPTION 'A query embedding is required.' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(p_embedding_model), '') IS NULL
     OR char_length(btrim(p_embedding_model)) > 160 THEN
    RAISE EXCEPTION 'A valid embedding model is required.' USING ERRCODE = '22023';
  END IF;

  IF p_match_threshold IS NULL
     OR p_match_threshold < 0
     OR p_match_threshold > 1 THEN
    RAISE EXCEPTION 'Match threshold must be between 0 and 1.' USING ERRCODE = '22023';
  END IF;

  IF p_match_count IS NULL OR p_match_count < 1 OR p_match_count > 20 THEN
    RAISE EXCEPTION 'Match count must be between 1 and 20.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    product.id,
    product.slug,
    product.name,
    product.description,
    CASE WHEN seller.status = 'approved' THEN seller.store_name ELSE NULL END,
    CASE WHEN seller.status = 'approved' THEN seller.store_slug ELSE NULL END,
    product_index.source_text,
    1.0 - (product_index.embedding OPERATOR(extensions.<=>) p_query_embedding)
  FROM public.product_embeddings AS product_index
  JOIN public.products AS product ON product.id = product_index.product_id
  LEFT JOIN public.sellers AS seller ON seller.id = product.seller_id
  WHERE product.status = 'published'
    AND product_index.embedding IS NOT NULL
    AND product_index.embedding_model = btrim(p_embedding_model)
    AND product_index.embedded_source_version = product_index.source_version
    AND 1.0 - (product_index.embedding OPERATOR(extensions.<=>) p_query_embedding) >= p_match_threshold
  ORDER BY product_index.embedding OPERATOR(extensions.<=>) p_query_embedding,
           product.id
  LIMIT p_match_count;
END;
$$;

REVOKE ALL ON FUNCTION public.match_ai_products(
  extensions.vector,
  text,
  double precision,
  integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_ai_products(
  extensions.vector,
  text,
  double precision,
  integer
) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS, grants, and safe activity audit
-- ---------------------------------------------------------------------------

ALTER TABLE public.kb_article_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_embeddings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kb_article_chunks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.product_embeddings FROM PUBLIC, anon, authenticated;

CREATE POLICY "Service role can manage AI knowledge chunks"
  ON public.kb_article_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage product embeddings"
  ON public.product_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL PRIVILEGES ON public.kb_article_chunks TO service_role;
GRANT ALL PRIVILEGES ON public.product_embeddings TO service_role;

CREATE FUNCTION public.audit_ai_kb_article_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action text;
  v_article_id uuid;
  v_slug text;
  v_title text;
  v_status text;
  v_metadata jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'ai.kb_article.created';
    v_article_id := NEW.id;
    v_slug := NEW.slug;
    v_title := NEW.title;
    v_status := NEW.status;
    v_metadata := jsonb_build_object(
      'slug', v_slug,
      'title', v_title,
      'status', v_status,
      'source_type', NEW.source_type
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'ai.kb_article.deleted';
    v_article_id := OLD.id;
    v_slug := OLD.slug;
    v_title := OLD.title;
    v_status := OLD.status;
    v_metadata := jsonb_build_object(
      'slug', v_slug,
      'title', v_title,
      'status', v_status,
      'source_type', OLD.source_type
    );
  ELSE
    v_article_id := NEW.id;
    v_slug := NEW.slug;
    v_title := NEW.title;
    v_status := NEW.status;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'ai.kb_article.status_changed';
      v_metadata := jsonb_build_object(
        'slug', v_slug,
        'title', v_title,
        'previous_status', OLD.status,
        'status', NEW.status
      );
    ELSIF OLD.title IS DISTINCT FROM NEW.title
          OR OLD.content IS DISTINCT FROM NEW.content
          OR OLD.slug IS DISTINCT FROM NEW.slug
          OR OLD.excerpt IS DISTINCT FROM NEW.excerpt
          OR OLD.source_type IS DISTINCT FROM NEW.source_type
          OR OLD.source_reference IS DISTINCT FROM NEW.source_reference
          OR OLD.category IS DISTINCT FROM NEW.category
          OR OLD.tags IS DISTINCT FROM NEW.tags THEN
      v_action := 'ai.kb_article.updated';
      v_metadata := jsonb_build_object(
        'slug', v_slug,
        'title', v_title,
        'status', v_status,
        'source_type', NEW.source_type
      );
    ELSIF OLD.embedded_at IS DISTINCT FROM NEW.embedded_at
          OR OLD.embedding_model IS DISTINCT FROM NEW.embedding_model THEN
      -- Service-role indexing is logged explicitly by replace_ai_kb_index so
      -- the validated admin actor is retained instead of appearing as system.
      IF auth.uid() IS NULL THEN
        RETURN NEW;
      END IF;
      v_action := 'ai.kb_article.indexed';
      v_metadata := jsonb_build_object(
        'slug', v_slug,
        'title', v_title,
        'status', v_status,
        'embedding_model', NEW.embedding_model
      );
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.record_activity(
    auth.uid(),
    NULL,
    v_action,
    'ai_knowledge',
    v_article_id::text,
    v_metadata
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_ai_kb_article_activity() FROM PUBLIC;

CREATE TRIGGER audit_ai_kb_article_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_ai_kb_article_activity();

COMMENT ON TABLE public.kb_article_chunks IS
  'Private, service-managed semantic chunks for published AI knowledge retrieval.';
COMMENT ON TABLE public.product_embeddings IS
  'Private product semantic index with optimistic source versioning; only published products are retrievable.';
COMMENT ON FUNCTION public.replace_ai_kb_index(
  uuid,
  timestamp with time zone,
  text,
  text,
  extensions.vector,
  jsonb,
  uuid
) IS 'Atomically replaces an article centroid and all semantic chunks if its updated_at value is still current.';
COMMENT ON FUNCTION public.store_ai_product_embedding(
  bigint,
  bigint,
  text,
  text,
  extensions.vector
) IS 'Stores a product embedding only when the canonical source version is still current and the product is published.';

COMMIT;
