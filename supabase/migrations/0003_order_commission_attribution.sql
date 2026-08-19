-- Multi-seller marketplace migration
-- Phase 3: order and commission attribution
-- Date: 2026-08-19
--
-- Attribution values must be calculated and written by the application/server
-- order-creation flow using products.seller_id and the seller's commission
-- rate at the time of purchase. Do not add a database trigger for this logic.
-- Defaults preserve every existing order item without a data backfill.

ALTER TABLE public.order_items
  ADD COLUMN seller_id uuid NULL REFERENCES public.sellers(id),
  ADD COLUMN commission_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN seller_earning integer NOT NULL DEFAULT 0,
  ADD COLUMN payout_status text NOT NULL DEFAULT 'pending'
    CHECK (payout_status = ANY (ARRAY[
      'pending'::text,
      'held'::text,
      'released'::text,
      'refunded'::text
    ]));

CREATE INDEX order_items_seller_id_idx ON public.order_items (seller_id);
CREATE INDEX order_items_seller_payout_status_idx
  ON public.order_items (seller_id, payout_status);
