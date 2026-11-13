import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { MODE_COOKIE, schemaFor } from './lib/mode'

// Server-side twin of app/supabase.ts (server actions and download routes).
// Reads the demo-mode cookie of the current request.
export async function isDemoMode(): Promise<boolean> {
  try {
    return schemaFor((await cookies()).get(MODE_COOKIE)?.value) === 'demo'
  } catch {
    return false
  }
}

const modeAwareFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers)
  const schema = (await isDemoMode()) ? 'demo' : 'public'
  headers.set('Accept-Profile', schema)
  headers.set('Content-Profile', schema)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: modeAwareFetch } },
)
