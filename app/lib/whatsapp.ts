// One place for the approved WhatsApp template and for the small text helpers
// the server action and the dialog both need. No secrets live here: the token
// and the phone number id are read from .env.local on the server only.

/**
 * The approved Meta template `dermacon_commitment_reminder` (en, UTILITY).
 * It has exactly one body variable, {{1}} = the doctor's name, and a static
 * "Confirm Now" URL button. Copy taken from Meta on 2026-11-17; if the template
 * is edited in the CRM, update `body` / `button` here so the preview stays true.
 */
export const WHATSAPP_TEMPLATE = {
  name: 'dermacon_commitment_reminder',
  language: 'en',
  body: 'Dear Dr. {{1}},\n\nGreetings from DERMACON 2027. We have sent your scientific commitment letter to your email. Kindly check your inbox and confirm your availability by clicking the link provided in the email. Thank you.',
  button: {
    text: 'Confirm Now',
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSdxz_5YnX30AkhVuTEBYiTjAU5Ps38Qa_-Fx-uQS3fbG1cWcg/viewform?usp=dialog',
  },
} as const;

/** The exact text a recipient sees, with the name filled in. */
export function renderWhatsAppTemplate(name: string): string {
  return WHATSAPP_TEMPLATE.body.replace(/\{\{1\}\}/g, name || '');
}

// "Dr. Uzzaif Shaikh" -> "Uzzaif Shaikh". The template already prints "Dear Dr.",
// so keeping the title would produce "Dear Dr. Dr. Uzzaif".
const NAME_TITLE = /^(dr|doctor|prof|professor)(?:\.\s*|\s+)/i;

export function whatsappName(canonicalName: string | null | undefined): string {
  let name = String(canonicalName ?? '').replace(/\s+/g, ' ').trim();
  while (NAME_TITLE.test(name)) name = name.replace(NAME_TITLE, '').trim();
  return name;
}

export type PhoneCheck = { ok: boolean; e164: string; problem: string };

/**
 * Digits only, in the form Meta wants (country code first, no "+").
 * Handles "+91 98258 78228", "098258 78228", "0091 98258 78228" and plain
 * 10-digit Indian numbers. Anything shorter than 11 or longer than 15 digits is
 * reported as a problem instead of being guessed at.
 */
export function normalizeWhatsAppPhone(raw: string | null | undefined): PhoneCheck {
  const original = String(raw ?? '').trim();
  if (!original) return { ok: false, e164: '', problem: 'No phone number.' };

  let digits = original.replace(/\D/g, '');
  if (!digits) return { ok: false, e164: '', problem: 'The phone number has no digits.' };

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1);
  else if (digits.length === 10) digits = '91' + digits;

  if (digits.length < 11 || digits.length > 15) {
    return { ok: false, e164: '', problem: `"${original}" does not look like a full phone number.` };
  }
  return { ok: true, e164: digits, problem: '' };
}

/** +919825878228 -> "+91 •••••• 8228" (safe to show in a preview). */
export function maskPhone(e164: string | null | undefined): string {
  const digits = String(e164 ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  const country = digits.length > 10 ? digits.slice(0, digits.length - 10) : '';
  const rest = digits.slice(-10);
  return `${country ? `+${country} ` : ''}${'•'.repeat(Math.max(0, rest.length - 4))} ${rest.slice(-4)}`.trim();
}

/** One row of the "check before sending" list. */
export type WhatsAppPreviewRow = {
  facultyId: string;
  /** Display name, as stored (may still start with "Dr."). */
  name: string;
  /** The value of {{1}} that will be sent. */
  parameter: string;
  /** Masked destination, e.g. "+91 •••••• 8228". */
  phoneMasked: string;
  /** Full template text with the name filled in (used by the preview). */
  message: string;
  /** Non-blocking notes, e.g. "not marked as emailed". */
  warnings: string[];
  /** When set, this person is skipped. */
  problem: string;
  /** True when whatsapp_sent was already on. */
  alreadySent: boolean;
};
