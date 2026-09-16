import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  const db = useSupabaseAdmin();
  const page = Number(getQuery(event).page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw createError({ statusCode: 400, statusMessage: 'Invalid message page.' });
  const { data: report, error } = await db.from('buyer_seller_reports')
    .select('id, thread_id, reported_by, category, reason, status, created_at, reviewed_at, resolution_note, reporter:profiles!buyer_seller_reports_reported_by_fkey(full_name), reviewer:profiles!buyer_seller_reports_reviewed_by_fkey(full_name)')
    .eq('id', String(getRouterParam(event, 'id') || '')).maybeSingle();
  if (error) throw createError({ statusCode: 500, statusMessage: 'Report could not be loaded.' });
  if (!report) throw createError({ statusCode: 404, statusMessage: 'Report not found.' });
  const { data: messages, count, error: messageError } = await db.from('buyer_seller_messages')
    .select('id, content, sender_profile_id, created_at, sender:profiles!buyer_seller_messages_sender_profile_id_fkey(full_name)', { count: 'exact' })
    .eq('thread_id', report.thread_id).order('created_at', { ascending: false }).order('id')
    .range((page - 1) * 50, page * 50 - 1);
  if (messageError) throw createError({ statusCode: 500, statusMessage: 'Conversation evidence could not be loaded.' });
  return { report, messages: messages || [], totalMessages: count || 0 };
});
