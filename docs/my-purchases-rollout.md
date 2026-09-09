# My Purchases: implementation and rollout

## Delivered behavior

- Dashboard → My purchases (`/purchases`) includes the active purchase count, server pagination/search, license snapshots, order links, and download quota. Paid products appear before their first download.
- Owned products remain visible in the catalog with Purchased/View purchase actions. Catalog, detail, wishlist, cart, checkout and database guards reject repurchase across license tiers.
- One buyer/product checkout claim spans all license tiers. Unknown invoice outcomes remain pending and are reconciled by Xendit external ID; no time-based blind invoice retry.
- Late duplicate paid receipts remain recorded, do not grant extra ownership, and appear under admin Purchase conflicts. Seller payouts for conflicting pending/held items remain on refund review; admins cannot release a duplicate-payment hold.
- Successful refunds revoke the old ownership. A new paid purchase gets its own three-download counter; refunded orders and duplicate paid orders cannot use that counter.
- Quota means three **started server-authorized transfers**, not three proven filesystem saves. Interrupted transfers after authorization count. Historical counters above three stay intact, with zero remaining.

## Download security

`POST /api/purchases/download-tickets` verifies the bearer JWT and prepares a five-minute intent bound to its Supabase auth session and a short-lived HttpOnly/SameSite=Strict browser cookie. The stored token is hashed. Client request IDs are idempotent.

A native same-origin form POST to `/api/purchases/download` redeems the intent in a hidden iframe. The token is not placed in a URL. No ZIP Blob, storage redirect, signed URL or service credential is returned to the browser. CSP now permits same-origin frames; only the attachment endpoint permits same-origin framing, while application pages retain `frame-ancestors 'none'`.

The server opens the private storage stream and checks its first chunk before calling `start_purchase_download`. The RPC takes the same buyer/product advisory lock as checkout/refund, verifies the canonical paid ownership and active auth session, then atomically consumes the ticket and one quota. It refuses replay, expired/revoked tickets, old orders and exhausted counters. There is no quota reservation before this point and no decrement/recovery race. A commit immediately before a worker crash counts as an ambiguous started transfer.

Logout/account switch invalidates pending browser-bound tickets. The old `/api/orders/:id/download` GET returns 410. Browser table/column writes to ownership, order counters and download logs are revoked; the legacy counter RPC is no longer executable. A restrictive ZIP-bucket policy prevents buyer-created storage signed URLs while leaving image buckets and existing seller/admin policies intact.

Version one does not support reusable Range/resume requests. The transfer budget is 260 seconds and ZIP size cap remains 200 MB. Confirm deployment duration is sufficient before rollout; do not reintroduce a storage redirect to bypass runtime limits. The installed Nitro Vercel adapter declares response streaming support. See [Vercel streaming documentation](https://vercel.com/docs/functions/streaming-functions).

## Read-only remote audit — 2026-09-07

Remote migrations 0001–0040 match local history. `docs/sql/purchase-access-summary.sql` returned:

| Check | Count/result |
| --- | --- |
| Invalid ownership | 0 |
| Duplicate paid buyer/product pairs | 0 |
| Paid items missing ownership | 0 |
| Duplicate pending buyer/product pairs | 0 |
| Unknown pending invoices | 0 |
| Historical download counts above three | 1; preserved, no reset |
| ZIP bucket | Private, 209715200-byte cap |
| Auth session columns | id, user_id, not_after present |

Existing permissive buyer order/item/log policies were present; new table/column grant revocations prevent their write permissions from bypassing the API. The audit made no transaction or ownership changes.

## Local verification

Final local run: 53 tests passed, zero failures/skips (including the optional PostgreSQL fixture with its temporary package configured). Migration dry-run listed exactly `0041_purchase_eligibility.sql` and `0042_purchase_download_sessions.sql`; neither was applied remotely.

Run `npm run test:purchases` for targeted tests without building Nuxt. Source syntax tests parse changed Vue/TS/JS in memory; this is not a full type check or build. The full existing test suite can run with `node --experimental-vm-modules --test tests/*.test.mjs`.

The optional `purchaseDbIntegration.test.mjs` uses a PostgreSQL WASM package installed in a temporary directory, not a project dependency or remote database. Set `PURCHASE_TEST_PGLITE` to that package's `dist/index.js` to run it; otherwise it is explicitly skipped. It executes both actual migrations against an isolated fixture and checks checkout serialization, ownership, duplicate receipt/replay, exhaustion, pending competing claims, refund/repurchase, old-order rejection, expired/revoked/wrong-binding sessions, sign-out and grants. PGlite serializes queries: a multi-connection PostgreSQL stress test is still a deployment acceptance check, not a claimed result of this fixture.

The installed H3 Node adapter was tested over a local HTTP connection with a 6.25 MiB streamed response, without buffering the whole body or redirecting to storage. Native Android download behavior and a real 200 MB Vercel transfer have not been verified.

## Activation

1. Review the historical over-limit behavior: the existing item will have zero remaining; no historical counter is reset automatically.
2. Pause checkout/download entry briefly during rollout; the old app expects browser cart writes and the old download RPC, which the migration intentionally closes.
3. Re-run the read-only summary if production data changed. Then review the dry run and apply the two forward migrations:

   ```powershell
   npx.cmd supabase db query --linked --file docs/sql/purchase-access-summary.sql
   npx.cmd supabase db push --dry-run
   npx.cmd supabase db push
   npx.cmd supabase migration list
   ```

4. Deploy the matching application code immediately after migration. No new secret is required: existing Supabase URL/anon/service-role settings are reused. Keep service role server-only.
5. Allow previously issued 300-second signed URLs to expire and check storage/CDN cache behavior before treating the cutover as strict. Token lifetime alone is not a one-use guarantee; see [Supabase Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn).
6. In test mode, verify paid→My Purchases, downloads 1/2/3 and denied fourth, two devices racing the last quota, signed-out ticket rejection, successful refund→repurchase, and admin duplicate-payment review. Confirm the actual Vercel runtime can stream the largest ZIP within the configured duration and Android receives a native attachment.

No remote migration was applied and no real Xendit payment/refund was created during this implementation. Do not mark a migration applied with `migration repair` instead of executing its SQL.

## Product release updates (migration 0044)

- Every approved ZIP is an immutable release numbered `1.0`, `1.1`, ... `1.9`, `2.0` using an integer sequence in PostgreSQL.
- Seller ZIPs stay `pending_review`; only `published` releases are visible to the purchase downloader. Admin ZIPs may publish immediately.
- `order_item_file_downloads` owns the three-download allowance for each order item and release. The original `order_items.download_count` is retained as lifetime audit history and is never reset.
- Download sessions pin a `product_file_id`, so approval of a newer release cannot silently change an already-issued ticket.
- A successful refund revokes pending sessions and canonical ownership. A later repurchase uses a new order item and therefore a new allowance.

Before pushing 0044, run the read-only checks in `docs/sql/product-release-preflight.sql`, review every returned row, then use `npx.cmd supabase db push --dry-run`. Deploy the matching application code immediately after applying the migration because the new server endpoints require the new release columns, table, and RPC.
