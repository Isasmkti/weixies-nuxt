# Multi-seller RLS policy overview

This review covers the multi-seller migrations in `supabase/migrations/0001` through `0004`. It does not infer or replace any pre-existing policies that are absent from the supplied production schema snapshot.

| Table / fields | RLS | SELECT | INSERT | UPDATE | DELETE | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `sellers` | Enabled | Only owners can read their row and admins can read all rows. | An authenticated user can create one pending row for their own profile at the default commission rate. | Owners can update store details. A rejected owner can only resubmit through `rejected → pending` while clearing `rejection_reason`; all other status, commission, ownership, and rejection-reason changes are admin-only. | Denied to users; service role bypasses RLS. | Seller onboarding, approval, resubmission, and private financial configuration. The unique `profile_id` constraint limits one seller record per user. |
| `approved_seller_stores` view | Not applicable (restricted view) | `anon` and `authenticated` can read approved public store fields only: `id`, `store_name`, `store_slug`, `store_description`, and `created_at`. | Not applicable. | Not applicable. | Not applicable. | Public storefront discovery without exposing `profile_id`, bank information, commission rate, or seller workflow status. |
| `products` | Enabled | Public can read published products; sellers can read their own products in any status; admins can read all products. | Approved sellers can create products only with their own `seller_id`; admins can create platform-owned or seller-owned products. | Approved sellers can update only their own products; admins can update all products. | Only admins can delete. | Preserves the existing public marketplace while enforcing seller ownership for product writes. |
| `products.seller_id`, `products.status` | Covered by `products` RLS | Same as `products`. | Same as `products`. | Same as `products`. | Same as `products`. | `seller_id = NULL` continues to mean platform-owned; the safe `published` default keeps legacy products visible. |
| `order_items` | Not changed in this migration plan. | Governed by existing production policies, which were not included in the schema snapshot. | Checkout writes through the server-only service-role client. | Governed by existing production policies/service role. | Governed by existing production policies/service role. | Phase 3 adds attribution fields only; it deliberately does not add triggers or alter legacy order-item RLS. |
| `order_items.seller_id`, `commission_amount`, `seller_earning`, `payout_status` | Covered by existing `order_items` policy state. | Same as `order_items`. | Server checkout snapshots values when the item is created. | Payout workflow will update `payout_status` through trusted server/admin code. | Same as `order_items`. | Snapshot data for accounting and payout reconciliation. |
| `seller_payouts` | Enabled | Sellers can read only payouts whose `seller_id` belongs to them. Admins and the server service role can read all. | Only admins or the server service role. | Only admins or the server service role. | Only admins or the server service role. | Payout batches are platform-controlled financial records. |
| `seller_payout_items` | Enabled | Sellers can read only items linked to their own payout. Admins and the server service role can read all. | Only admins or the server service role. | Only admins or the server service role. | Only admins or the server service role. | Prevents a seller from discovering another seller's payout line items. |

## Authorization implementation notes

- `public.is_seller_platform_admin()` checks the existing `profiles.role = 'admin'` value without changing the `user_role` enum. It is used by all multi-seller admin policies.
- `server/utils/supabase-admin.ts` creates the project’s trusted server-only client with the Supabase service-role key. That role bypasses RLS by design; Phase 4 also states this permission explicitly in its policies.
- No seller policy grants `INSERT`, `UPDATE`, or `DELETE` on payout tables. The absence of such a policy is intentional and denies those operations under RLS.

## Security resolution: public seller data

`public.sellers` contains private bank and commission fields, so it has no public `SELECT` policy. `public.approved_seller_stores` is the approved public discovery surface and exposes only store-safe fields. This resolves the row-level-versus-column-level exposure risk while preserving public access to approved stores.
