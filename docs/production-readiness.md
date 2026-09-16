# Production readiness and rollout

The canonical database history is `supabase/migrations`. The retired
`current-sb-schema.sql` snapshot is not an input to development, tests, or
deployment.

## 1. Local quality gate

Use the supported Node.js version and run the test suite. This does not run a
Nuxt production build.

```powershell
node --version
npm test
```

The contract tests verify sequential migration versions, reviewed browser RPCs,
Vercel cron route existence, and the absence of runtime dependencies on the old
schema snapshot. GitHub Actions repeats this gate on pushes and pull requests.

## 2. Database rollout

Confirm that local and remote migration history match, inspect the dry run, and
then apply only the migrations reported as pending:

```powershell
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
npx.cmd supabase migration list
npx.cmd supabase db lint --linked --level warning
```

Migrations introduced by this hardening rollout:

1. `0047_security_advisor_hardening.sql`
2. `0048_system_job_runs.sql`

The linked-project verification on 2026-09-16 showed `0047` already applied and
only `0048` pending. Always trust the fresh `migration list` and dry-run output
for the target project rather than attempting to reapply an existing version.

Do not mark either migration as applied with `migration repair` unless its SQL
has already been applied to that exact database.

## 3. Dashboard settings and environment

- Enable **Leaked password protection** in Supabase Authentication settings.
- Confirm `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`,
  `XENDIT_PAYOUT_WEBHOOK_TOKEN`, `XENDIT_BUSINESS_ID`,
  `SUPABASE_SERVICE_ROLE_KEY`, and a random `CRON_SECRET` are configured as
  server-only production variables.
- Confirm `NUXT_PUBLIC_SITE_URL` matches the final HTTPS production origin.
- Never expose the service-role or Xendit secret with a `NUXT_PUBLIC_` prefix.

## 4. Application deployment

Deploy only after the database migrations succeed. The deployment registers:

- `/api/cron/payment-reconciliation` at `00:00 UTC` daily.
- `/api/cron/automated-payouts` at `02:00 UTC` daily.

Both endpoints use `CRON_SECRET`, a database execution lease, and durable
`system_job_runs` history. A duplicate invocation returns `already_running`
instead of starting a second provider operation.

## 5. Post-deployment smoke checks

Perform these checks with test-mode transactions before enabling production
money movement:

1. Sign in as buyer, seller, and admin; verify role redirects and logout.
2. Create an order and confirm a pending Xendit invoice is stored once.
3. Deliver a paid webhook twice; the second delivery must remain idempotent.
4. Confirm the purchase appears in My Purchases and its version download quota.
5. Start and resolve a refund; verify buyer access and seller funds follow the
   final provider state.
6. Trigger each cron once with its Bearer secret and confirm a completed row in
   `system_job_runs`.
7. Open `/admin` and confirm Operational health shows both automation jobs.
8. Check `/admin/payouts`, `/admin/orders`, and `/admin/logs` for provider or
   reconciliation exceptions.

## 6. Rollback boundaries

- Application rollback is safe while migrations `0047` and `0048` remain;
  both are additive except for deliberate privilege tightening.
- Do not delete payment, refund, payout, purchase, or job-run ledger rows to
  resolve an incident.
- Disable the affected Vercel cron before manual financial reconciliation.
- Preserve provider payloads and activity logs, then correct state through the
  existing reconciliation/refund/payout endpoints.
