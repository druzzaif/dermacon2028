'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../supabase';
import { Notice } from './ui';

const FacultyProfileModal = dynamic(() => import('./FacultyProfileModal'));

/**
 * Opens the faculty profile panel for one person, given only their id.
 * The full record is read first: the panel needs fields (country, type, whether they
 * were emailed before) that lists on other screens do not carry.
 */
export default function FacultyProfileHost({
  facultyId,
  onClose,
  onChanged,
}: {
  facultyId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [faculty, setFaculty] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setFaculty(null);
    setError(null);
    supabase
      .from('faculty')
      .select('*')
      .eq('id', facultyId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err || !data) setError(err?.message || 'This faculty record could not be found.');
        else setFaculty(data);
      });
    return () => { alive = false; };
  }, [facultyId]);

  if (error) {
    return (
      <div className="fixed bottom-4 left-1/2 z-[70] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 shadow-pop">
        <Notice tone="danger" title="Could not open the profile">
          {error}{' '}
          <button type="button" onClick={onClose} className="font-semibold underline">Dismiss</button>
        </Notice>
      </div>
    );
  }
  if (!faculty) return null;
  return <FacultyProfileModal faculty={faculty} onClose={onClose} onChanged={onChanged} />;
}
