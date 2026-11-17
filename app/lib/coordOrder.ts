// The three coordinator roles stored in session_coordinators.role.
export const LEAD_COORDINATOR_ROLE = 'Lead Coordinator';

// Coordinators appear in the order the lead coordinator arranged them.
// That order is stored in session_coordinators.coord_id (1, 2, 3 …).
// Rows with no number yet (older data) fall back to National → Lead → Local.
const ROLE_PRIORITY: Record<string, number> = { National: 1, [LEAD_COORDINATOR_ROLE]: 2, Local: 3 };

export function sortCoordinators<T extends { coord_id?: number | null; role?: string | null }>(rows: T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const an = a.r.coord_id ?? Infinity;
      const bn = b.r.coord_id ?? Infinity;
      if (an !== bn) return an === Infinity ? 1 : bn === Infinity ? -1 : an - bn;
      return (ROLE_PRIORITY[a.r.role || ''] || 99) - (ROLE_PRIORITY[b.r.role || ''] || 99) || a.i - b.i;
    })
    .map((x) => x.r);
}
