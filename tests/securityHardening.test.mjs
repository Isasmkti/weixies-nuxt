import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = readProjectFile('supabase/migrations/0047_security_advisor_hardening.sql')

test('security definer functions are closed and reopened through an explicit allowlist', () => {
  assert.match(migration, /function_definition\.prosecdef/)
  assert.match(migration, /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /ALTER DEFAULT PRIVILEGES IN SCHEMA public/)

  const authenticatedAllowlist = [
    'is_seller_platform_admin',
    'get_admin_dashboard',
    'get_seller_payout_candidates',
    'can_manage_product_assets',
    'can_manage_product_image_object',
    'seller_owns_order',
    'submit_verified_review',
    'is_buyer_seller_thread_participant',
    'mark_buyer_seller_thread_read',
    'register_product_file_release',
    'moderate_product_release',
  ]

  for (const functionName of authenticatedAllowlist) {
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}\\(`))
  }

  assert.doesNotMatch(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.replace_product_images[\s\S]{0,120}TO authenticated/,
  )
})

test('trigger functions and legacy mutable search paths are hardened', () => {
  assert.match(migration, /prorettype = 'pg_catalog\.trigger'::regtype/)
  assert.match(migration, /'generate_slug'/)
  assert.match(migration, /'ensure_single_primary_image'/)
  assert.match(migration, /'set_wishlist_profile_id'/)
  assert.match(migration, /ALTER FUNCTION %s SET search_path TO public, pg_catalog/)
})

test('payment writes and public bucket listings are no longer client-writable or listable', () => {
  assert.match(migration, /DROP POLICY IF EXISTS "Authenticated can upsert own payments"/)
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.payments FROM anon, authenticated/)
  assert.match(migration, /cmd = 'SELECT'/)
  assert.match(migration, /Public can view product images/)
  assert.match(migration, /Public can view home carousel images/)
})

test('the rollout documents the dashboard-only leaked-password setting', () => {
  const documentation = readProjectFile('docs/security-hardening.md')

  assert.match(documentation, /current-sb-schema\.sql.*not used or\s+modified/)
  assert.match(documentation, /Leaked-password protection/)
  assert.match(documentation, /db push --dry-run/)
})
