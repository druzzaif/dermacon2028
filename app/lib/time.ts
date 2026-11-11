/* ------------------------------------------------------------------
   Time helpers. Values are stored as 24-hour "HH:MM:00" strings (the
   database format); the screen always shows 12-hour time with AM/PM.
   ------------------------------------------------------------------ */

export type AmPm = 'AM' | 'PM';

/** "14:30:00" -> { h12: 2, m: 30, ampm: 'PM' }; empty/invalid -> null */
export function splitTime(value: string | null | undefined): { h12: number; m: number; ampm: AmPm } | null {
  if (!value) return null;
  const [hs, ms] = value.split(':');
  const h = parseInt(hs, 10);
  const m = parseInt(ms ?? '0', 10);
  if (isNaN(h) || isNaN(m)) return null;
  const ampm: AmPm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { h12, m, ampm };
}

export function joinTime(h12: number, m: number, ampm: AmPm): string {
  let h = h12 % 12;
  if (ampm === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** "14:30:00" -> "2:30" (no AM/PM) */
export function formatClock(value: string | null | undefined): string {
  const t = splitTime(value);
  return t ? `${t.h12}:${String(t.m).padStart(2, '0')}` : '';
}

/** "14:30:00" -> "2:30 PM" */
export function formatTime12(value: string | null | undefined): string {
  const t = splitTime(value);
  if (!t) return '--:--';
  return `${t.h12}:${String(t.m).padStart(2, '0')} ${t.ampm}`;
}

export function toMinutes(value: string | null | undefined): number | null {
  const t = splitTime(value);
  if (!t) return null;
  return ((t.h12 % 12) + (t.ampm === 'PM' ? 12 : 0)) * 60 + t.m;
}

export function fromMinutes(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00`;
}

export function addMinutes(value: string, delta: number): string {
  return fromMinutes((toMinutes(value) ?? 0) + delta);
}

/** A plain hour with no am/pm, read the way a conference day runs: 7-11 morning, 12-6 afternoon */
export function dayAmPm(h12: number): AmPm {
  return h12 >= 7 && h12 <= 11 ? 'AM' : 'PM';
}

/**
 * Reads what a person types. Accepts "9", "930", "0930", "9:30", "9.30",
 * "9 30", "2pm", "2:15 p.m.", "14:30". Hours 13-23 are read as 24-hour time.
 * AM/PM comes from, in order: `forced` (the AM/PM switch was just clicked),
 * am/pm in the text, then the conference day (7-11 = AM, 12-6 = PM).
 * Returns the "HH:MM:00" value and the AM/PM it ended up with, or null.
 */
export function parseTimeText(text: string, forced?: AmPm): { value: string; ampm: AmPm } | null {
  let s = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  let mer: AmPm | null = null;
  const suffix = s.match(/\s*([ap])\.?\s*(m\.?)?$/);
  if (suffix && suffix.index !== undefined && suffix.index > 0) {
    mer = suffix[1] === 'p' ? 'PM' : 'AM';
    s = s.slice(0, suffix.index).trim();
  }
  let h: number;
  let m: number;
  const sep = s.match(/^(\d{1,2})\s*[:.\sh-]\s*(\d{1,2})$/);
  if (sep) {
    h = parseInt(sep[1], 10);
    m = parseInt(sep[2], 10); // "10:5" is read literally as 10:05
  } else if (/^\d{1,4}$/.test(s)) {
    if (s.length <= 2) { h = parseInt(s, 10); m = 0; }
    else if (s.length === 3) { h = parseInt(s.slice(0, 1), 10); m = parseInt(s.slice(1), 10); }
    else { h = parseInt(s.slice(0, 2), 10); m = parseInt(s.slice(2), 10); }
  } else {
    return null;
  }
  if (m > 59 || h > 23) return null;
  if (h === 0) return { value: joinTime(12, m, 'AM'), ampm: 'AM' };      // 00:xx = 12:xx AM
  if (h >= 13) return { value: joinTime(h - 12, m, 'PM'), ampm: 'PM' };  // 24-hour input
  const use: AmPm = forced ?? mer ?? dayAmPm(h);
  return { value: joinTime(h, m, use), ampm: use };
}
