import { createClient } from '@supabase/supabase-js'
import { readModeCookie, schemaFor } from './lib/mode'

// In the browser, talk to the database through this app (/sb, see next.config.ts)
// instead of 127.0.0.1:54321. On a phone or iPad, 127.0.0.1 is the phone itself,
// so the pages loaded but showed no data. On the server, connect directly.
const supabaseUrl =
  typeof window !== 'undefined'
    ? `${window.location.origin}/sb`
    : process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Demo mode: every request is sent to the "demo" schema instead of "public".
// Decided per request, so the toggle needs no changes anywhere else in the app.
const modeAwareFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers)
  const schema = schemaFor(readModeCookie())
  headers.set('Accept-Profile', schema)
  headers.set('Content-Profile', schema)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: modeAwareFetch },
})
