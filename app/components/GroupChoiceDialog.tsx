'use client';

import { useState } from 'react';
import Modal from './Modal';
import { Button } from './ui';

export type GroupChoice = 'all' | 'workshop' | 'scientific';

/** For PDFs made for several faculty at once: everything, Workshops only, or Scientific sessions only */
export default function GroupChoiceDialog({
  title = 'Which sessions should the PDFs include?',
  confirmLabel = 'Generate',
  onChoose,
  onClose,
}: {
  title?: string;
  confirmLabel?: string;
  onChoose: (group: GroupChoice) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<GroupChoice>('all');
  const options: { value: GroupChoice; label: string; help: string }[] = [
    { value: 'all', label: 'Everything', help: 'Every topic and role each person has.' },
    { value: 'workshop', label: 'Workshops only', help: 'Sessions whose code starts with WS or MC.' },
    { value: 'scientific', label: 'Scientific sessions only', help: 'All other sessions.' },
  ];
  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onChoose(group)}>{confirmLabel}</Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">{title}</legend>
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${group === o.value ? 'border-accent bg-accent-tint' : 'border-line bg-white'}`}
          >
            <input type="radio" name="pdf-group" className="mt-0.5" checked={group === o.value} onChange={() => setGroup(o.value)} />
            <span>
              <span className="font-semibold text-ink">{o.label}</span>
              <span className="block text-ink-2">{o.help}</span>
            </span>
          </label>
        ))}
        <p className="pt-1 text-xs text-muted">People with no topics in the chosen part are skipped.</p>
      </fieldset>
    </Modal>
  );
}
