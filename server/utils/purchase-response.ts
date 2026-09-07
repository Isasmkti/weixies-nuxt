export { purchaseResponse, positivePurchaseId } from '~/utils/purchaseResponse.js';

// This projection deliberately excludes storage paths, provider payloads, and
// other buyers' information. Every caller also filters the ownership and order.
export const PURCHASE_SELECT = `
  id, product_id, order_id, created_at,
  product:products!inner(
    id, name, slug, status,
    product_images(image_url, is_primary),
    product_files(file_url, file_name, file_size, version, created_at),
    seller:sellers(id, store_name, store_slug)
  ),
  order:orders!inner(
    id, profile_id, status, purchase_conflict, order_number, paid_at,
    order_items(
      id, product_id, price, is_downloaded, downloaded_at, download_count, download_limit,
      order_item_licenses(
        license_name_snapshot, usage_terms_snapshot,
        allow_commercial_use_snapshot, allow_resale_snapshot
      )
    )
  )
`;
