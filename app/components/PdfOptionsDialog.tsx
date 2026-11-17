'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import TopicPicker from './TopicPicker';
import { Button, LoadingBlock, Notice } from './ui';
import { getFacultyTopicChoices } from '../actions';
import { allTopicIds, selectionToIds, type TopicChoice } from '../lib/topicChoices';

/**
 * Asks which topics (or whole groups: Scientific sessions / Workshops) a faculty PDF should
 * contain, then opens the PDF in a new tab.
 */
export default function PdfOptionsDialog({
  facultyId,
  name,
  onClose,
}: {
  facultyId: string;
  name: string;
  onClose: () => void;
}) {
  const [choices, setChoices] = useState<TopicChoice[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getFacultyTopicChoices(facultyId)
      .then((r) => {
        if (!alive) return;
        if (!r.success) { setError(r.message || 'Could not load the topics.'); setChoices([]); return; }
        setChoices(r.choices as TopicChoice[]);
        setSelected(allTopicIds(r.choices as TopicChoice[]));
      })
      .catch((e) => { if (alive) { setError(e?.message || 'Could not load the topics.'); setChoices([]); } });
    return () => { alive = false; };
  }, [facultyId]);

  function generate() {
    if (!choices) return;
    const ids = selectionToIds(choices, selected);
    const qs = new URLSearchParams({ id: facultyId });
    if (ids) qs.set('topics', ids.join(','));
    window.open(`/api/generate-pdf?${qs.toString()}`, '_blank', 'noopener');
    onClose();
  }

  const count = selected.size;
  return (
    <Modal
      title="Generate PDF"
      subtitle={name}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={generate} disabled={!choices || count === 0}>
            Generate PDF{choices && choices.length > 0 ? ` (${count} of ${choices.length} topics)` : ''}
          </Button>
        </>
      }
    >
      {choices === null && <LoadingBlock>Loading topics…</LoadingBlock>}
      {error && <Notice tone="danger">{error}</Notice>}
      {choices && choices.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">Choose what goes into this PDF. Tick a heading to include everything under it.</p>
          <TopicPicker topics={choices} selected={selected} onChange={setSelected} />
          {count === 0 && <Notice tone="warning">Tick at least one topic.</Notice>}
        </div>
      )}
    </Modal>
  );
}
