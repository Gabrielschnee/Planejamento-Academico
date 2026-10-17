import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ctcqvdeyoynluzddlgcc.supabase.co'
const supabaseAnonKey = 'sb_publishable_ffgdoBhnEQuh7Fi2-1IY1A_sCcQpDOH'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)