// Demo mode: the same app, but reading/writing the separate "demo" database
// schema (dummy faculty). The choice is remembered in a cookie so the browser,
// server actions and download routes all agree.
export const MODE_COOKIE = 'dermacon_mode';
export type AppMode = 'live' | 'demo';

export function schemaFor(mode: string | null | undefined): 'public' | 'demo' {
  return mode === 'demo' ? 'demo' : 'public';
}

// Browser only
export function readModeCookie(): AppMode {
  if (typeof document === 'undefined') return 'live';
  const m = document.cookie.match(new RegExp('(?:^|; )' + MODE_COOKIE + '=([^;]*)'));
  return m && decodeURIComponent(m[1]) === 'demo' ? 'demo' : 'live';
}
