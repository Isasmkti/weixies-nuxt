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

The refund endpoint currently accepts full-order refunds. It rejects partial
refunds so seller earnings cannot be reversed by an ambiguous amount.


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
