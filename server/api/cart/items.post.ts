import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { requireRequestUser } from '~/server/utils/request-auth';
import { findSelfPurchaseConflicts, isSelfPurchaseDatabaseError, throwSelfPurchase } from '~/server/utils/self-purchase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  const { user } = await requireRequestUser(event);
  const body = await readBody(event).catch(() => ({}));
  const productId = Number(body?.product_id);
  const productLicenseId = String(body?.product_license_id || '').trim();

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'A valid product_id is required.' });
  }
  if (!UUID.test(productLicenseId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid product_license_id is required.' });
  }

  const supabase = useSupabaseAdmin();
  const conflicts = await findSelfPurchaseConflicts(supabase, user.id, [productId]);
  if (conflicts.length) throwSelfPurchase('cart', conflicts);

  const { data: license, error: licenseError } = await supabase
    .from('product_licenses')
    .select('id')
    .eq('id', productLicenseId)
    .eq('product_id', productId)
    .eq('is_active', true)
    .maybeSingle();
  if (licenseError) throw licenseError;
  if (!license) throw createError({ statusCode: 404, statusMessage: 'The selected product license is unavailable.' });

  const { data: cart, error: cartError } = await supabase
    .from('cart')
    .upsert({ profile_id: user.id }, { onConflict: 'profile_id', ignoreDuplicates: false })
    .select('id')
    .single();
  if (cartError) throw cartError;

  const { data: existing, error: lookupError } = await supabase
    .from('cart_items')
    .select('id')
    .eq('cart_id', cart.id)
    .eq('product_id', productId)
    .eq('product_license_id', productLicenseId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { item: existing, created: false };

  const { data: item, error: insertError } = await supabase
    .from('cart_items')
    .insert({ cart_id: cart.id, product_id: productId, product_license_id: productLicenseId })
    .select('id, cart_id, product_id, product_license_id')
    .single();

  if (insertError) {
    if (isSelfPurchaseDatabaseError(insertError)) throwSelfPurchase('cart', [productId]);
    throw insertError;
  }

  setResponseStatus(event, 201);
  return { item, created: true };
});
