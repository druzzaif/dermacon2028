// CME sessions (CME1, CME2, …) are labelled "Session 1", "Session 2", … on printouts.
export function printCode(code: string | null | undefined): string {
  const c = String(code ?? '').trim();
  const m = /^CME\s*0*(\d+)$/i.exec(c);
  return m ? `Session ${m[1]}` : c;
}
