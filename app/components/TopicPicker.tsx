'use client';

import { useEffect, useRef } from 'react';
import Badge from './Badge';
import { groupChoices, type TopicChoice } from '../lib/topicChoices';

function GroupCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label} />;
}

/**
 * "Which topics?" checklist. Topics sit under their heading (Scientific sessions / Workshops);
 * ticking a heading ticks everything under it. The role chips tick every topic with that role.
 */
export default function TopicPicker({
  topics,
  selected,
  onChange,
  disabled = false,
}: {
  topics: TopicChoice[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const groups = groupChoices(topics);
  const roles = [...new Set(topics.map((t) => t.role))];

  function toggleMany(ids: string[], turnOn: boolean) {
    const next = new Set(selected);
    ids.forEach((id) => (turnOn ? next.add(id) : next.delete(id)));
    onChange(next);
  }
  function toggleOne(id: string) {
    toggleMany([id], !selected.has(id));
  }

  return (
    <div className="space-y-3">
      {roles.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-muted">By role:</span>
          {roles.map((role) => {
            const ids = topics.filter((t) => t.role === role).map((t) => t.topicId);
            const all = ids.every((id) => selected.has(id));
            return (
              <button
                key={role}
                type="button"
                disabled={disabled}
                onClick={() => toggleMany(ids, !all)}
                aria-pressed={all}
                className={`rounded-full border px-2.5 py-1 font-medium transition-colors disabled:opacity-50 ${
                  all ? 'border-accent bg-accent-tint text-accent' : 'border-field bg-white text-ink-2 hover:bg-slate-50'
                }`}
              >
                {role} ({ids.length})
              </button>
            );
          })}
        </div>
      )}

      {groups.map((g) => {
        const ids = g.topics.map((t) => t.topicId);
        const on = ids.filter((id) => selected.has(id)).length;
        return (
          <fieldset key={g.group} disabled={disabled} className="rounded-lg border border-line bg-white">
            <legend className="sr-only">{g.label}</legend>
            <label className="flex cursor-pointer items-center gap-2.5 border-b border-line bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">
              <GroupCheckbox
                checked={on === ids.length}
                indeterminate={on > 0 && on < ids.length}
                onChange={() => toggleMany(ids, on !== ids.length)}
                label={`Select all ${g.label}`}
              />
              {g.label}
              <span className="tnum font-normal text-muted">{on} of {ids.length}</span>
            </label>
            <ul className="divide-y divide-line">
              {g.topics.map((t) => (
                <li key={t.topicId}>
                  <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.has(t.topicId)}
                      onChange={() => toggleOne(t.topicId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="tnum font-medium text-accent">{t.session}</span>{' '}
                      <span className="text-ink">{t.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span>Hall {t.hall}</span>
                        <span className="tnum">{t.time}</span>
                        <Badge tone={t.role === 'Chairperson' ? 'orange' : 'blue'}>{t.role}</Badge>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}
