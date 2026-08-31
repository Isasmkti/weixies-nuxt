# Nuxt Minimal Starter

Required runtime: Node.js 22.19.0 or newer.

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

repositories/   ← NEW: Supabase queries
services/       ← business logic (6 files, no UI services)
stores/         ← Pinia state (6 files)
composables/    ← Vue reactivity hooks (4 files, includes the 2 moved from services)
utils/          ← helpers + supabase client
pages/          ← routes
components/     ← UI components
plugins/        ← Nuxt plugins
middleware/     ← route guard
layouts/        ← page layouts

# supabase migrate

npx.cmd supabase db push --dry-run
npx.cmd supabase db push
npx.cmd supabase migration list

Apply database migrations before deploying matching server code. Security RPCs
used by checkout and downloads must exist before the new application build is
started.

## Xendit webhooks

Configure the Xendit callback token as `XENDIT_WEBHOOK_TOKEN` (or
`NUXT_XENDIT_WEBHOOK_TOKEN` in the deployed Nitro runtime), then register both
public HTTPS endpoints in the Xendit dashboard:

- Invoice/payment callback: `/api/webhook/xendit`
- Successful refund callback: `/api/webhook/xendit-refund`
- Payout status callback: `/api/webhook/xendit-payout`

The refund endpoint currently accepts full-order refunds. It rejects partial
refunds so seller earnings cannot be reversed by an ambiguous amount.

Automated seller payouts use Xendit Payouts API v3. The secret API key must
have `MONEY-OUT` permission. Configure `XENDIT_PAYOUT_WEBHOOK_TOKEN` with the
PAYOUT webhook verification token (it falls back to `XENDIT_WEBHOOK_TOKEN`),
and set `XENDIT_BUSINESS_ID` so payout callbacks are also matched to the
expected Xendit business. Subscribe the payout endpoint above to succeeded,
failed, reversed, rejected, and pending-compliance events.

Xendit dashboard checklist for seller payouts:

1. Activate Payouts for the business and make sure the account has an IDR
   balance.
2. Create a development/production secret API key with `MONEY-OUT` permission
   and place it in the matching server environment as `XENDIT_SECRET_KEY`.
3. Under Developer settings > Webhooks > PAYOUT, register
   `https://your-domain.example/api/webhook/xendit-payout`.
4. Copy the callback verification token to `XENDIT_PAYOUT_WEBHOOK_TOKEN` and
   the Xendit Business ID to `XENDIT_BUSINESS_ID`.
5. Confirm the Indonesia-to-Indonesia IDR beneficiary routing values against
   Xendit's current Dynamic Schema Sheet before the first production payout.

## AI customer service (Phases 1-3)

The AI customer-service foundation, secure chat flow, and knowledge retrieval
are implemented.
Apply these migrations before deploying the matching application code:

- `0022_ai_customer_service_foundation.sql`
- `0023_ai_chat_interaction_state.sql`
- `0024_ai_rag_knowledge_products.sql`

Configure these private server variables locally or in the deployment
environment:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.7-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
```

For a deployed Nitro runtime, use `NUXT_GEMINI_API_KEY` and optionally
`NUXT_GEMINI_MODEL` and `NUXT_GEMINI_EMBEDDING_MODEL`. Do not use a
`NUXT_PUBLIC_` prefix. Gemini generation calls use the Interactions API with
`store: false`, so Supabase remains the authoritative conversation store.

Also set `NUXT_PUBLIC_SITE_URL` to the exact production origin, for example
`https://marketplace.example`. The chat POST endpoint validates this origin in
production.

The global customer-service widget calls only the same-origin Nuxt endpoints:

- `GET /api/ai/chat` loads the most recent active conversation.
- `POST /api/ai/chat` persists a customer message and generates one AI reply.

Authenticated users own conversations through their Supabase profile. Guests
receive an opaque, host-only HttpOnly cookie; only its SHA-256 hash is stored in
the database. Requests are rate limited, client message IDs are idempotent, and
pending generation leases prevent duplicate Gemini calls. Internal prompts,
provider state, token usage, and raw error details are never returned to the
browser.

Phase 3 retrieves matching chunks from published knowledge articles and stable
public product descriptions. Product edits invalidate their private semantic
index automatically, and article edits invalidate both the article marker and
its chunks. Vectors and indexing RPCs remain service-role only. Chat responses
may return sanitized source labels and links, but never vectors or internal
retrieval metadata.

Use `/admin/ai/knowledge` to create, edit, publish, archive, and index verified
articles. Publishing and indexing are deliberately separate actions: only a
published, successfully indexed article can be retrieved. The **Index Products**
action processes a bounded batch of new or stale published products; repeat it
until it reports no new indexed rows after a large catalog import.

RAG does not grant access to live orders, payments, refunds, accounts, current
prices, stock/availability, seller balances, or private customer data. Those
facts require authenticated tools in a later phase. If retrieval is unavailable
or has no sufficiently relevant match, chat generation continues with the
restricted base prompt and must acknowledge that verified information is
unavailable.

An authenticated platform admin can validate the connection without exposing
the key or accepting arbitrary prompt input:

```powershell
$adminToken = '<admin-supabase-access-token>'
Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/api/admin/ai/validate' `
  -Headers @{ Authorization = "Bearer $adminToken" }
```

This endpoint is limited to three checks per admin per minute. The public chat
continues to return a safe fallback message if Gemini is unavailable; the
failure is stored with non-sensitive metadata for later diagnosis.


## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
