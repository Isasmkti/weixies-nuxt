import { requireRequestUser } from '~/server/utils/request-auth';

export async function requirePlatformAdmin(event: any) {
  const requestUser = await requireRequestUser(event);
  const { data: isAdmin, error } = await requestUser.supabase.rpc('is_seller_platform_admin');

  if (error) {
    console.error('[Admin auth] Role verification failed:', { code: error.code || 'unknown' });
    throw createError({ statusCode: 500, statusMessage: 'Admin access could not be verified.' });
  }
  if (!isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Platform admin access is required.' });
  }

  return requestUser;
}
