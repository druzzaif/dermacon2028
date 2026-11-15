import 'server-only';
import { SHARED_VENUE_MAP_PATH } from './venueRooms.mjs';

export function buildVenueEmailLink() {
  const configuredUrl = process.env.APP_PUBLIC_URL?.trim();
  if (!configuredUrl) {
    throw new Error('Set APP_PUBLIC_URL to the deployed HTTPS app address before preparing faculty emails.');
  }

  let base: URL;
  try {
    base = new URL(configuredUrl);
  } catch {
    throw new Error('APP_PUBLIC_URL must be a valid absolute URL, such as https://your-project.vercel.app.');
  }

  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  const isLocalDevelopmentUrl = process.env.NODE_ENV !== 'production' && base.protocol === 'http:' && localHost;
  if (
    (base.protocol !== 'https:' && !isLocalDevelopmentUrl) ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  ) {
    throw new Error('APP_PUBLIC_URL must be an HTTPS origin with no path, query, or credentials. HTTP is allowed only for localhost development.');
  }

  return new URL(SHARED_VENUE_MAP_PATH, base.origin).toString();
}
