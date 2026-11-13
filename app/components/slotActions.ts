'use client';

import { supabase } from '../supabase';
import { resequenceSession } from '../actions';
import { addMinutes } from '../lib/time';

/**
 * Moves topics earlier by a number of minutes (used to close an empty slot).
 * Only start and end times change; titles, faculty and confirmations are untouched.
 * The running-order numbers are rebuilt afterwards, as after any time change.
 */
export async function moveTopicsEarlier(
  sessionId: string,
  topics: { id: string; start_time: string | null; end_time: string | null }[],
  minutes: number,
): Promise<{ success: boolean; message: string; moved: number }> {
  if (minutes <= 0 || topics.length === 0) return { success: true, message: 'Nothing to move.', moved: 0 };
  let moved = 0;
  // Earliest first, so two topics never swap order half-way through
  const ordered = [...topics]
    .filter((t) => t.start_time && t.end_time)
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
  for (const t of ordered) {
    const { error } = await supabase
      .from('session_topics')
      .update({ start_time: addMinutes(t.start_time!, -minutes), end_time: addMinutes(t.end_time!, -minutes) })
      .eq('id', t.id);
    if (error) {
      await resequenceSession(sessionId);
      return {
        success: false,
        moved,
        message: `${moved} of ${ordered.length} topics were moved, then this failed: ${error.message}. Check the times in this session.`,
      };
    }
    moved++;
  }
  await resequenceSession(sessionId);
  return { success: true, message: `${moved} topic${moved === 1 ? '' : 's'} moved ${minutes} minutes earlier.`, moved };
}
