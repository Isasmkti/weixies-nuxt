import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fvqvdcsbbklxmnqusrlb.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_WCN1OssVUJja7c159tuslQ_ouBV5LGC'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
