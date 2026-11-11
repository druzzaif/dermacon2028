import { createClient } from '@supabase/supabase-js'

// In the browser, talk to the database through this app (/sb, see next.config.ts)
// instead of 127.0.0.1:54321. On a phone or iPad, 127.0.0.1 is the phone itself,
// so the pages loaded but showed no data. On the server, connect directly.
const supabaseUrl =
  typeof window !== 'undefined'
    ? `${window.location.origin}/sb`
    : process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
