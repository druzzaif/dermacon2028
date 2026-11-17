'use client';

import { useState } from 'react';
import Modal from './Modal';
import { Button } from './ui';

export type PrintRow = { name: string; email: string; phone: string; roles: string };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Prints exactly the faculty rows passed in (the list as filtered on screen), with the
 * columns the user ticks. Opens the browser print view, where "Save as PDF" makes the PDF.
 */
export default function FacultyListPrintDialog({
  rows,
  filterNote,
  onClose,
}: {
  rows: PrintRow[];
  filterNote: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(true);
  const [contact, setContact] = useState(true);
  const [roles, setRoles] = useState(true);

  function print() {
    const cols: { head: string; cell: (r: PrintRow) => string }[] = [{ head: '#', cell: () => '' }];
    if (name) cols.push({ head: 'Name', cell: (r) => `<strong>${esc(r.name)}</strong>` });
    if (contact) cols.push({ head: 'Contact', cell: (r) => [r.email, r.phone].filter(Boolean).map(esc).join('<br>') || '—' });
    if (roles) cols.push({ head: 'Roles · session assignments', cell: (r) => esc(r.roles) || '—' });

    const body = rows
      .map((r, i) => `<tr>${cols.map((c, ci) => `<td>${ci === 0 ? i + 1 : c.cell(r)}</td>`).join('')}</tr>`)
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Faculty list</title>
<style>
  body{font-family:Arial,sans-serif;font-size:10pt;color:#111;margin:14mm}
  h1{font-size:14pt;margin:0 0 2px} p{margin:0 0 10px;color:#555;font-size:9pt}
  table{width:100%;border-collapse:collapse} th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#f0f0f0} tr{page-break-inside:avoid} thead{display:table-header-group}
  td:first-child,th:first-child{width:28px;text-align:right}
</style></head><body>
<h1>DERMACON faculty list</h1>
<p>${rows.length} faculty · ${esc(filterNote)} · printed ${new Date().toLocaleDateString('en-GB')}</p>
<table><thead><tr>${cols.map((c) => `<th>${c.head}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('The print window was blocked. Allow pop-ups for this site and try again.'); return; }
    w.document.write(html);
    w.document.close();
    onClose();
  }

  return (
    <Modal
      title="Print faculty list"
      subtitle={`${rows.length} faculty, exactly as shown on screen.`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={print} disabled={rows.length === 0 || (!name && !contact && !roles)}>
            Print / save as PDF
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2 text-sm text-ink">
        <legend className="mb-2 font-medium">Include</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={name} onChange={(e) => setName(e.target.checked)} /> Name</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} /> Contact details (email, phone)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={roles} onChange={(e) => setRoles(e.target.checked)} /> Roles · session assignments</label>
      </fieldset>
      <p className="mt-3 text-xs text-muted">In the print window choose “Save as PDF” as the printer to get a PDF file.</p>
    </Modal>
  );
}
