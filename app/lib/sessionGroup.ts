/* Which programme a session belongs to.

   The app has always treated a session as a workshop when its code starts with
   WS or MC (MasterClasses included). Everything else — the scientific programme
   (SP…), CME (CME…), plenaries — is a scientific session. Emails, PDFs and the
   Faculty filters all use this same rule, so a count shown here matches what a
   bulk action would touch.

   Kept in its own module, with no server-only imports, so client pages can use
   it too; commitmentPdfHtml re-exports it for the server code. */

export type Programme = 'workshop' | 'scientific';

export function isWorkshopSession(code: string | null | undefined): boolean {
  return /^(WS|MC)/i.test(String(code || '').trim());
}

export function programmeOf(code: string | null | undefined): Programme {
  return isWorkshopSession(code) ? 'workshop' : 'scientific';
}

export const PROGRAMME_LABEL: Record<Programme, string> = {
  workshop: 'Workshops',
  scientific: 'Scientific sessions',
};
