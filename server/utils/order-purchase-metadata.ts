import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { downloadMetadata, validProductZipPath } from '~/utils/purchaseDownload.js';

// Relations are loaded in bounded batches. Orders remain immutable history;
// active ownership plus the latest approved release grants download access.
export async function attachOrderPurchaseMetadata(orders: any[], profileId: string) {
  const items = orders.flatMap(order => order.order_items || []);
  const productIds = [...new Set(items.map((item: any) => item.product_id))].filter(Boolean);
  const itemIds = [...new Set(items.map((item: any) => item.id))].filter(Boolean);
  if (!productIds.length) return orders;

  const db = useSupabaseAdmin();
  const ownership = new Map<string, string>();
  const releasesByProduct = new Map<string, any[]>();
  const usagesByItem = new Map<string, any[]>();

  for (let offset = 0; offset < productIds.length; offset += 100) {
    const batch = productIds.slice(offset, offset + 100);
    const [owned, releases] = await Promise.all([
      db.from('user_products').select('product_id,order_id').eq('profile_id', profileId).in('product_id', batch),
      db.from('product_files')
        .select('id,product_id,file_url,version,version_sequence,published_at,created_at')
        .in('product_id', batch).eq('release_status', 'published')
        .order('version_sequence', { ascending: false }),
    ]);
    if (owned.error || releases.error) throw createError({ statusCode: 503, statusMessage: 'Purchase access could not be checked.' });
    for (const row of owned.data || []) ownership.set(String(row.product_id), row.order_id);
    for (const release of releases.data || []) {
      const key = String(release.product_id);
      releasesByProduct.set(key, [...(releasesByProduct.get(key) || []), release]);
    }
  }

  for (let offset = 0; offset < itemIds.length; offset += 100) {
    const batch = itemIds.slice(offset, offset + 100);
    const result = await db.from('order_item_file_downloads')
      .select('order_item_id,product_file_id,download_count,download_limit,first_downloaded_at,last_downloaded_at')
      .in('order_item_id', batch);
    if (result.error) throw createError({ statusCode: 503, statusMessage: 'Download allowances could not be checked.' });
    for (const usage of result.data || []) {
      const key = String(usage.order_item_id);
      usagesByItem.set(key, [...(usagesByItem.get(key) || []), usage]);
    }
  }

  return orders.map(order => ({ ...order, order_items: (order.order_items || []).map((item: any) => {
    const productKey = String(item.product_id);
    const releases = releasesByProduct.get(productKey) || [];
    const latest = releases[0] || null;
    const usages = usagesByItem.get(String(item.id)) || [];
    const currentUsage = usages.find(usage => String(usage.product_file_id) === String(latest?.id));
    const fileAvailable = Boolean(latest && validProductZipPath(latest.file_url, item.product_id));
    const access = order.status === 'paid' && !order.purchase_conflict && ownership.get(productKey) === order.id;
    const metadata = downloadMetadata({
      download_count: currentUsage?.download_count || 0,
      download_limit: currentUsage?.download_limit || 3,
      is_downloaded: Number(currentUsage?.download_count) > 0,
      downloaded_at: currentUsage?.last_downloaded_at || null,
    }, access, fileAvailable);
    return {
      ...item,
      ...metadata,
      lifetime_download_count: Math.max(0, Number(item.download_count) || 0),
      latest_version: latest?.version || null,
      has_purchase_access: access,
      download_unavailable_reason: !access ? 'This order does not have active download access.'
        : !fileAvailable ? 'The product file is currently unavailable. Please contact the seller.'
          : metadata.downloads_remaining === 0 ? `Download limit reached for version ${latest?.version || ''}.`.trim() : null,
    };
  }) }));
}
