// People on a topic: speakers, moderators, panelists, debaters, chairpersons.
// The order is stored in faculty_topics.sort_order (1, 2, 3 …). Older rows with no
// number fall back to: Moderator, Faculty, Panelist, Debater, Chairperson.

export const ROLE_OPTIONS = ['Faculty', 'Moderator', 'Panel', 'Debater', 'Chairperson', 'Coordinator'] as const;

export function roleName(role?: string | null) {
  const r = role || 'Faculty';
  return r === 'Panel' ? 'Panelist' : r;
}

const RANK: Record<string, number> = { Moderator: 1, Faculty: 2, Panel: 3, Panelist: 3, Debater: 4, Chairperson: 5 };

export function sortTopicPeople<T extends { role?: string | null; sort_order?: number | null }>(rows: T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const an = a.r.sort_order ?? Infinity;
      const bn = b.r.sort_order ?? Infinity;
      if (an !== bn) return an === Infinity ? 1 : bn === Infinity ? -1 : an - bn;
      return (RANK[a.r.role || 'Faculty'] || 9) - (RANK[b.r.role || 'Faculty'] || 9) || a.i - b.i;
    })
    .map((x) => x.r);
}

export const isPanelRole = (role?: string | null) => role === 'Moderator' || role === 'Panel' || role === 'Panelist' || role === 'Debater';

export type PanelGroups = { moderators: string[]; panelists: string[]; debaters: string[] };

// Names grouped by role, in arranged order. `skip` removes one person (the reader of the letter).
export function panelGroups(
  rows: { role?: string | null; sort_order?: number | null; name: string; id?: string }[],
  skipId?: string,
): PanelGroups {
  const g: PanelGroups = { moderators: [], panelists: [], debaters: [] };
  for (const r of sortTopicPeople(rows)) {
    if (skipId && r.id === skipId) continue;
    if (r.role === 'Moderator') g.moderators.push(r.name);
    else if (r.role === 'Panel' || r.role === 'Panelist') g.panelists.push(r.name);
    else if (r.role === 'Debater') g.debaters.push(r.name);
  }
  return g;
}

// "Moderator: A · Panelists: 1. B; 2. C" – used in Excel cells
export function panelText(g: PanelGroups): string {
  const num = (a: string[]) => a.map((n, i) => `${i + 1}. ${n}`).join('; ');
  return [
    g.moderators.length ? `Moderator${g.moderators.length > 1 ? 's' : ''}: ${g.moderators.join('; ')}` : '',
    g.panelists.length ? `Panelists: ${num(g.panelists)}` : '',
    g.debaters.length ? `Debaters: ${num(g.debaters)}` : '',
  ].filter(Boolean).join(' | ');
}
