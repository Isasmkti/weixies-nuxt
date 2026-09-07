import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { downloadMetadata, validProductZipPath } from '~/utils/purchaseDownload.js';

// One batch for each relation, not one round trip per item. Orders remain an
// audit history; only the canonical active entitlement grants download access.
export async function attachOrderPurchaseMetadata(orders: any[], profileId: string) {
  const ids = [...new Set(orders.flatMap(order => (order.order_items || []).map((item: any) => item.product_id)))].filter(Boolean);
  if (!ids.length) return orders;
  const db = useSupabaseAdmin();
  const ownership = new Map<string, string>();
  const files = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const [owned, fileRows] = await Promise.all([
      db.from('user_products').select('product_id,order_id').eq('profile_id', profileId).in('product_id', batch),
      db.from('product_files').select('product_id,file_url,created_at').in('product_id', batch).order('created_at', { ascending: false }),
    ]);
    if (owned.error || fileRows.error) throw createError({ statusCode: 503, statusMessage: 'Purchase access could not be checked.' });
    for (const row of owned.data || []) ownership.set(String(row.product_id), row.order_id);
    const seen = new Set();
    for (const file of fileRows.data || []) {
      const key = String(file.product_id);
      if (seen.has(key)) continue;
      seen.add(key);
      if (validProductZipPath(file.file_url, file.product_id)) files.add(key);
    }
  }
  return orders.map(order => ({ ...order, order_items: (order.order_items || []).map((item: any) => {
    const key = String(item.product_id);
    const access = order.status === 'paid' && !order.purchase_conflict && ownership.get(key) === order.id;
    const metadata = downloadMetadata(item, access, files.has(key));
    return { ...item, ...metadata, has_purchase_access: access,
      download_unavailable_reason: !access ? 'This order does not have active download access.'
        : !files.has(key) ? 'The product file is currently unavailable. Please contact the seller.'
          : metadata.downloads_remaining === 0 ? 'Download limit reached.' : null };
  }) }));
}
