export async function recordAdminActivity(
  supabase: any,
  user: any,
  action: string,
  entityType: string,
  entityId: string | number,
  metadata: Record<string, unknown> = {},
) {
  const actorName = String(user?.user_metadata?.full_name || user?.email || 'Administrator').trim();
  const { error } = await supabase.from('activity_logs').insert({
    actor_profile_id: user?.id || null,
    actor_name: actorName,
    actor_type: 'admin',
    action,
    entity_type: entityType,
    entity_id: String(entityId),
    metadata,
  });

  if (error) {
    console.error('[Admin activity] Log insert failed:', { action, code: error.code || 'unknown' });
  }
}
