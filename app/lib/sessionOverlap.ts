import { supabase } from '../supabase';

export type SessionOverlap = {
  code: string;
  name: string;
  hall: string;
  date: string;
  start: string;
  end: string;
};

/** A hall that is blank, "TBD" or "null" is not a real room, so it never counts as an overlap */
export function isRealHall(hall: string | null | undefined): boolean {
  const t = (hall || '').trim().toLowerCase();
  return t !== '' && t !== 'tbd' && t !== 'null';
}

/**
 * Other sessions in the same hall, on the same date, whose time overlaps [start, end).
 * Back-to-back sessions (one ends exactly when the next starts) are fine.
 * Pass `id` when editing so the session is not compared with itself.
 * Times are "HH:MM:00" strings, which compare correctly as text.
 */
export async function findSessionOverlaps(s: {
  id?: string;
  hall: string;
  date: string;
  start: string;
  end: string;
}): Promise<SessionOverlap[]> {
  if (!isRealHall(s.hall) || !s.date || !s.start || !s.end) return [];

  let q = supabase
    .from('conference_sessions')
    .select('id, session_code, session_name, hall, session_date, start_time, end_time')
    .eq('session_date', s.date);
  if (s.id) q = q.neq('id', s.id);
  const { data, error } = await q;
  if (error) throw error;

  const hall = s.hall.trim().toLowerCase();
  return (data || [])
    .filter(
      (o: any) =>
        (o.hall || '').trim().toLowerCase() === hall &&
        s.start < (o.end_time || '') &&
        (o.start_time || '') < s.end
    )
    .map((o: any) => ({
      code: o.session_code || '',
      name: o.session_name || '',
      hall: o.hall || '',
      date: o.session_date || '',
      start: o.start_time || '',
      end: o.end_time || '',
    }));
}
