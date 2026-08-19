# Nuxt Minimal Starter

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
