# Supabase security hardening

Migration `0047_security_advisor_hardening.sql` is the source of truth for the
first security gate. The retired `current-sb-schema.sql` snapshot is not used or
modified.

## What the migration changes

- Revokes direct `anon` and `authenticated` execution of every
  `SECURITY DEFINER` function, then restores only the reviewed browser/RLS RPC
  allowlist.
- Revokes direct execution of all trigger functions.
- Prevents future functions from inheriting PostgreSQL's default `PUBLIC`
  execute grant.
- Fixes the legacy mutable `search_path` functions reported by the advisor.
- Removes the permissive client payment-write policy and keeps payment writes
  on the service role.
- Removes unrestricted object-listing policies from public Storage buckets;
  public asset URLs continue to work.

## Apply and verify

Review the pending migration before applying it:

```powershell
npx.cmd supabase db push --dry-run
```

Apply it when the dry run lists only the expected migration:

```powershell
npx.cmd supabase db push
```

Then rerun the linked database linter:

```powershell
npx.cmd supabase db lint --linked --level warning
```

Also smoke-test admin dashboard data, seller payout candidates, seller product
uploads, product reviews, and buyer/seller read-state updates. These are the
authenticated RPCs deliberately retained by the allowlist.

## Dashboard-only setting

Leaked-password protection is an Auth project setting rather than a schema
migration. In the Supabase Dashboard, open Authentication settings, find
**Leaked password protection**, enable it, and save. This is the only advisor
item in this gate that `db push` cannot apply.
