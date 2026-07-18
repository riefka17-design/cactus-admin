import { createClient } from '@supabase/supabase-js'


const supabaseUrl = "https://tqcilayorwdpkmwwntji.supabase.co"

const supabaseAnonKey = "sb_publishable_wt7D58DbNeKwmFFDdON-gg_OonF3-JV"


export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)