/* ------------------------------------------------------------------
   Empty slots in a session, worked out from the topic times alone
   (nothing extra is stored in the database).

   An empty slot is time inside the session that no topic covers:
     - between one topic's end and the next topic's start (always shown)
     - before the first topic / after the last topic, measured against the
       session's own start and end time (only when every topic has a time,
       otherwise an untimed topic may be what fills that space)
   Used by the Sessions screen, the delete-topic dialog and both printouts.
   ------------------------------------------------------------------ */
import { fromMinutes, toMinutes } from './time';

export type TimedTopic = { id: string; start_time: string | null; end_time: string | null };

export type EmptySlot = {
  start: string;                // "HH:MM:00"
  end: string;                  // "HH:MM:00"
  minutes: number;
  /** The slot sits just before this topic; null = after the last topic */
  beforeTopicId: string | null;
};

type Timed = { id: string; a: number; b: number };

function timed(topics: TimedTopic[]): Timed[] {
  return topics
    .map((t) => ({ id: String(t.id), a: toMinutes(t.start_time), b: toMinutes(t.end_time) }))
    .filter((t): t is Timed => t.a !== null && t.b !== null && t.b > t.a)
    .sort((x, y) => x.a - y.a || x.b - y.b);
}

export function findEmptySlots(
  topics: TimedTopic[],
  session?: { start_time?: string | null; end_time?: string | null } | null,
): EmptySlot[] {
  const list = timed(topics);
  if (list.length === 0) return [];
  const everyTopicTimed = list.length === topics.length;
  const slots: EmptySlot[] = [];
  const add = (from: number, to: number, beforeTopicId: string | null) =>
    slots.push({ start: fromMinutes(from), end: fromMinutes(to), minutes: to - from, beforeTopicId });

  const sessionStart = toMinutes(session?.start_time);
  const sessionEnd = toMinutes(session?.end_time);

  if (everyTopicTimed && sessionStart !== null && list[0].a > sessionStart) add(sessionStart, list[0].a, list[0].id);

  let covered = list[0].b;
  for (let i = 1; i < list.length; i++) {
    if (list[i].a > covered) add(covered, list[i].a, list[i].id);
    covered = Math.max(covered, list[i].b);
  }

  if (everyTopicTimed && sessionEnd !== null && sessionEnd > covered) add(covered, sessionEnd, null);
  return slots;
}

/**
 * What deleting one topic would leave behind.
 * freed: minutes that nothing else covers once the topic is gone (0 when another
 *        topic runs at the same time, e.g. two speakers sharing one slot)
 * later: the topics that start at or after the deleted topic's end
 */
export function effectOfDeleting(topicId: string, topics: TimedTopic[]) {
  const all = timed(topics);
  const me = all.find((t) => t.id === String(topicId));
  if (!me) return { freed: 0, from: null as string | null, to: null as string | null, laterIds: [] as string[] };
  const others = all.filter((t) => t.id !== me.id);
  // Minutes of [me.a, me.b] not covered by any other topic
  let freed = 0;
  for (let m = me.a; m < me.b; m++) if (!others.some((o) => o.a <= m && m < o.b)) freed++;
  const laterIds = others.filter((o) => o.a >= me.b).map((o) => o.id);
  return { freed, from: fromMinutes(me.a), to: fromMinutes(me.b), laterIds };
}
