'use client';

import { useState } from 'react';
import { sortTopicPeople } from '../lib/topicPeople';
import Modal from './Modal';
import { formatTime12, toMinutes } from '../lib/time';
import { findEmptySlots, type EmptySlot } from '../lib/slots';
import { Fragment } from 'react';
import { Button } from './ui';

export type PrintOptions = { chairs: boolean; confirmed: boolean; contacts: boolean; emptySlots: boolean; topicsOnly: boolean };
export const DEFAULT_PRINT_OPTIONS: PrintOptions = { chairs: true, confirmed: true, contacts: false, emptySlots: false, topicsOnly: false };

const isTbd = (f: any) => !f || f.faculty_id === 'FAC000' || /^TBD/i.test(String(f.canonical_name || '').trim());
const roleLabel = (r: string | null | undefined) => {
  const x = r || 'Faculty';
  return x === 'Panel' ? 'Panelist' : x === 'Lead Coordinator' ? 'Lead coordinator' : x;
};

function formatDate(d: string | null | undefined) {
  if (!d) return 'Date TBD';
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Small dialog shown when you click Print on the Sessions page */
export function PrintOptionsDialog({
  initial,
  onCancel,
  onPrint,
}: {
  initial: PrintOptions;
  onCancel: () => void;
  onPrint: (o: PrintOptions) => void;
}) {
  const [o, setO] = useState<PrintOptions>(initial);
  const choices: { k: keyof PrintOptions; title: string; desc: string }[] = [
    { k: 'topicsOnly', title: 'Topics only', desc: 'Just the table of topics. Leaves out the session chair and coordinator lines above it.' },
    { k: 'chairs', title: 'Include chairpersons', desc: 'Shown under each topic they chair.' },
    { k: 'confirmed', title: 'Show who has confirmed', desc: 'Adds ✓ after faculty who confirmed (as of the last sync).' },
    { k: 'emptySlots', title: 'Show empty slots', desc: 'Adds a marked row wherever no topic is scheduled. Leave unticked to print the topics only.' },
    { k: 'contacts', title: 'Add a contact page', desc: 'A separate page with name, role, phone and email of every coordinator, chairperson and faculty in this session.' },
  ];
  return (
    <Modal
      title="Print session"
      size="sm"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => onPrint(o)}>Print</Button>
        </>
      }
    >
      <div className="space-y-2">
        {choices.map(({ k, title, desc }) => (
          <label key={k} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-white p-3 hover:bg-slate-50">
            <input type="checkbox" className="mt-0.5" checked={o[k]} onChange={(e) => setO({ ...o, [k]: e.target.checked })} />
            <span>
              <span className="block text-sm font-medium text-ink">{title}</span>
              <span className="block text-xs text-ink-2">{desc}</span>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

/**
 * The printed version of one session. Hidden on screen, shown only when printing.
 * topics: session_topics with faculty_topics ( role, confirmed, faculty ( id, canonical_name, phone, email ) )
 * coordinators: session_coordinators with role and faculty ( id, canonical_name, phone, email )
 */
export function SessionPrintSheet({
  session,
  topics,
  coordinators,
  sessionChairs = [],
  options,
}: {
  session: any;
  topics: any[];
  coordinators: any[];
  sessionChairs?: any[];
  options: PrintOptions;
}) {
  const cell = 'border border-[#bbb] px-2 py-1.5 align-top';
  const head = 'border border-[#bbb] bg-[#eee] px-2 py-1.5 text-left font-bold';

  // ---- contact lists (one row per person per section) ----
  type Person = { name: string; phone: string; email: string; what: string[] };
  const collect = (rows: { f: any; what: string }[]) => {
    const m = new Map<string, Person>();
    for (const { f, what } of rows) {
      if (isTbd(f)) continue;
      const key = f.id || f.canonical_name;
      const p: Person = m.get(key) || { name: f.canonical_name, phone: f.phone || '', email: /@placeholder\.com$/i.test(f.email || '') ? '' : f.email || '', what: [] };
      if (what && !p.what.includes(what)) p.what.push(what);
      m.set(key, p);
    }
    return [...m.values()];
  };
  const coordPeople = collect(coordinators.map((c) => ({ f: c.faculty, what: roleLabel(c.role) })));
  const chairPeople = collect(
    topics.flatMap((t) => (t.faculty_topics || []).filter((ft: any) => ft.role === 'Chairperson')
      .map((ft: any) => ({ f: ft.faculty, what: `No. ${t.sequence_no ?? '?'}` })))
  );
  const facultyPeople = collect(
    topics.flatMap((t) => (t.faculty_topics || []).filter((ft: any) => ft.role !== 'Chairperson')
      .map((ft: any) => ({ f: ft.faculty, what: roleLabel(ft.role) })))
  ).sort((a, b) => a.name.localeCompare(b.name));

  const ContactTable = ({ title, people, whatLabel }: { title: string; people: Person[]; whatLabel: string }) =>
    people.length === 0 ? null : (
      <div className="mb-5" style={{ breakInside: 'avoid-page' }}>
        <h3 className="mb-1.5 text-[11pt] font-bold">{title} ({people.length})</h3>
        <table className="w-full border-collapse text-[9.5pt]" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '30%' }} /><col style={{ width: '20%' }} /><col style={{ width: '18%' }} /><col style={{ width: '32%' }} />
          </colgroup>
          <thead><tr><th className={head}>Name</th><th className={head}>{whatLabel}</th><th className={head}>Phone</th><th className={head}>Email</th></tr></thead>
          <tbody>
            {people.map((p, i) => (
              <tr key={i}>
                <td className={`${cell} font-semibold`}>{p.name}</td>
                <td className={cell}>{p.what.join(', ')}</td>
                <td className={`${cell} tnum`}>{p.phone || '—'}</td>
                <td className={cell} style={{ overflowWrap: 'anywhere' }}>{p.email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  // Empty slots (worked out from the times), printed only when ticked
  const slots: EmptySlot[] = options.emptySlots ? findEmptySlots(topics, session) : [];
  const slotsPrinted = new Set<string>();
  const trailing = slots.find((g) => g.beforeTopicId === null) || null;
  const slotRow = (g: EmptySlot) => (
    <tr key={`slot-${g.start}`} style={{ breakInside: 'avoid' }}>
      <td className={`${cell} text-center font-semibold`}>–</td>
      <td className={`${cell} tnum whitespace-nowrap`}>{formatTime12(g.start)}<br />{formatTime12(g.end)}</td>
      <td className={`${cell} font-semibold italic`} colSpan={2}>Empty slot ({g.minutes} min): no topic scheduled</td>
    </tr>
  );

  const titleBlock = (
    <div className="mb-3 border-b-2 border-black pb-2">
      <h2 className="text-[15pt] font-bold leading-tight">{session.session_code} – {session.session_name}</h2>
      <p className="mt-1 text-[10pt]">
        {formatDate(session.session_date)} · {formatTime12(session.start_time)} – {formatTime12(session.end_time)} · {session.hall ? `Hall ${session.hall}` : 'Hall TBD'}
        {session.session_type ? ` · ${session.session_type}` : ''}
      </p>
    </div>
  );

  return (
    <div className="session-print-sheet hidden text-black print:block">
      {titleBlock}

      {!options.topicsOnly && sessionChairs.length > 0 && (
        <p className="mb-1 text-[9.5pt]">
          <strong>Session chair: </strong>
          {sessionChairs.map((c, i) => (
            <span key={i}>{i > 0 && ' · '}{i + 1}. {c.faculty?.canonical_name}</span>
          ))}
        </p>
      )}

      {!options.topicsOnly && coordinators.length > 0 && (
        <p className="mb-3 text-[9.5pt]">
          <strong>Coordinators: </strong>
          {coordinators.filter((c) => !isTbd(c.faculty)).map((c, i) => (
            <span key={i}>{i > 0 && ' · '}{i + 1}. {c.faculty?.canonical_name} ({roleLabel(c.role)})</span>
          ))}
        </p>
      )}

      <table className="w-full border-collapse text-[10pt]" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '6%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '45%' }} />
          <col style={{ width: '32%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={`${head} text-center`}>No.</th>
            <th className={head}>Time</th>
            <th className={head}>Topic</th>
            <th className={head}>Faculty{options.chairs ? ' / Chair' : ''}</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((t) => {
            const links = t.faculty_topics || [];
            const speakers = sortTopicPeople(links.filter((ft: any) => ft.role !== 'Chairperson'));
            const chairs = options.chairs ? links.filter((ft: any) => ft.role === 'Chairperson') : [];
            const before = slots.find((g) => g.beforeTopicId !== null && !slotsPrinted.has(g.start) && toMinutes(g.end) === toMinutes(t.start_time));
            if (before) slotsPrinted.add(before.start);
            return (
              <Fragment key={t.id}>
              {before && slotRow(before)}
              <tr style={{ breakInside: 'avoid' }}>
                <td className={`${cell} text-center font-semibold`}>{t.sequence_no}</td>
                <td className={`${cell} tnum whitespace-nowrap`}>{formatTime12(t.start_time)}<br />{formatTime12(t.end_time)}</td>
                <td className={`${cell} font-semibold leading-snug`}>{t.topic_title}</td>
                <td className={cell}>
                  {speakers.length === 0 && chairs.length === 0 && <em>Unassigned</em>}
                  {speakers.map((ft: any, i: number) => (
                    <div key={i}>
                      {speakers.length > 1 ? `${i + 1}. ` : ''}{ft.faculty?.canonical_name}
                      {ft.role && ft.role !== 'Faculty' ? ` (${roleLabel(ft.role)})` : ''}
                      {options.confirmed && ft.confirmed ? ' ✓' : ''}
                    </div>
                  ))}
                  {chairs.length > 0 && (
                    <div className={speakers.length ? 'mt-1 border-t border-dashed border-[#bbb] pt-1' : ''}>
                      <strong>Chair: </strong>
                      {chairs.map((ft: any, i: number) => (
                        <span key={i}>{i > 0 && ', '}{ft.faculty?.canonical_name}{options.confirmed && ft.confirmed ? ' ✓' : ''}</span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
              </Fragment>
            );
          })}
          {trailing && slotRow(trailing)}
        </tbody>
      </table>
      {options.confirmed && <p className="mt-2 text-[8.5pt]">✓ = confirmed (as of the last sync)</p>}

      {options.contacts && (
        <div style={{ breakBefore: 'page' }}>
          <div className="mb-3 border-b-2 border-black pb-2">
            <h2 className="text-[15pt] font-bold leading-tight">Contacts – {session.session_code} {session.session_name}</h2>
            <p className="mt-1 text-[10pt]">{formatDate(session.session_date)} · {session.hall ? `Hall ${session.hall}` : 'Hall TBD'}</p>
          </div>
          <ContactTable title="Coordinators" people={coordPeople} whatLabel="Role" />
          {options.chairs && <ContactTable title="Chairpersons" people={chairPeople} whatLabel="Chairs topic" />}
          <ContactTable title="Faculty" people={facultyPeople} whatLabel="Role" />
        </div>
      )}
    </div>
  );
}
