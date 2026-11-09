'use client';

import { useState } from 'react';
import { supabase } from '../supabase';
import { generatePDFForSession, generatePDFsForSessionFaculty } from '../actions';

export default function EditSessionModal({
  session,
  onClose,
  onSaved,
}: {
  session: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [sessionPdfUrl, setSessionPdfUrl] = useState<string | null>(null);
  const [sessionPdfBusy, setSessionPdfBusy] = useState(false);
  const [sessionPdfError, setSessionPdfError] = useState<string | null>(null);
  const [showPostSave, setShowPostSave] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse initial 24h time to 12h components
  const parseInitial = (timeStr: string | null | undefined) => {
    if (!timeStr) return { h: 9, m: 0, ampm: 'AM' };
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { h, m, ampm };
  };

  const initStart = parseInitial(session.start_time);
  const initEnd = parseInitial(session.end_time);

  const [startH, setStartH] = useState(initStart.h);
  const [startM, setStartM] = useState(initStart.m);
  const [startAmPm, setStartAmPm] = useState(initStart.ampm);

  const [endH, setEndH] = useState(initEnd.h);
  const [endM, setEndM] = useState(initEnd.m);
  const [endAmPm, setEndAmPm] = useState(initEnd.ampm);

  const to24Hour = (h: number, m: number, ampm: string) => {
    let h24 = h;
    if (ampm === 'PM' && h24 < 12) h24 += 12;
    if (ampm === 'AM' && h24 === 12) h24 = 0;
    return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  };

  const scrollH = (e: React.WheelEvent, current: number, setter: (v: number) => void) => {
    if (e.deltaY < 0) setter(current === 12 ? 1 : current + 1);
    else setter(current === 1 ? 12 : current - 1);
  };
  const scrollM = (e: React.WheelEvent, current: number, setter: (v: number) => void) => {
    if (e.deltaY < 0) setter(current === 59 ? 0 : current + 1);
    else setter(current === 0 ? 59 : current - 1);
  };

  function TimePicker({
    label,
    h,
    setH,
    m,
    setM,
    ampm,
    setAmPm,
  }: {
    label: string;
    h: number;
    setH: (v: number) => void;
    m: number;
    setM: (v: number) => void;
    ampm: string;
    setAmPm: (v: string) => void;
  }) {
    return (
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 shadow-sm">
          <div className="flex flex-col items-center">
            <button type="button" onClick={() => setH(h === 12 ? 1 : h + 1)} className="text-gray-400 hover:text-blue-600 px-2 text-[10px]">▲</button>
            <input
              type="number"
              min={1}
              max={12}
              value={String(h).padStart(2, '0')}
              onChange={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val)) val = 12;
                if (val > 12) val = 12;
                if (val < 1) val = 1;
                setH(val);
              }}
              onWheel={(e) => scrollH(e, h, setH)}
              className="w-8 text-center text-lg font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" onClick={() => setH(h === 1 ? 12 : h - 1)} className="text-gray-400 hover:text-blue-600 px-2 text-[10px]">▼</button>
          </div>
          
          <span className="text-lg font-bold text-gray-400">:</span>
          
          <div className="flex flex-col items-center">
            <button type="button" onClick={() => setM(m === 59 ? 0 : m + 1)} className="text-gray-400 hover:text-blue-600 px-2 text-[10px]">▲</button>
            <input
              type="number"
              min={0}
              max={59}
              value={String(m).padStart(2, '0')}
              onChange={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val)) val = 0;
                if (val > 59) val = 59;
                if (val < 0) val = 0;
                setM(val);
              }}
              onWheel={(e) => scrollM(e, m, setM)}
              className="w-10 text-center text-lg font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" onClick={() => setM(m === 0 ? 59 : m - 1)} className="text-gray-400 hover:text-blue-600 px-2 text-[10px]">▼</button>
          </div>

          <div className="flex flex-col border-l border-gray-200 ml-1 pl-1">
            <button
              type="button"
              onClick={() => setAmPm('AM')}
              className={`px-2 py-0.5 text-xs font-bold rounded ${ampm === 'AM' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => setAmPm('PM')}
              className={`px-2 py-0.5 text-xs font-bold rounded ${ampm === 'PM' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              PM
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    const updates = {
      session_name: formData.get('session_name') as string,
      session_type: formData.get('session_type') as string,
      session_date: formData.get('session_date') as string,
      hall: formData.get('hall') as string || null,
      start_time: to24Hour(startH, startM, startAmPm),
      end_time: to24Hour(endH, endM, endAmPm),
    };

    const { error: updateError } = await supabase
      .from('conference_sessions')
      .update(updates)
      .eq('id', session.id);

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onSaved();
    setShowPostSave(true);
  }

  async function renderSessionPdf() {
    setSessionPdfBusy(true); setSessionPdfError(null);
    const r = await generatePDFForSession(session.id);
    setSessionPdfBusy(false);
    if (r.success) setSessionPdfUrl((r as any).url);
    else setSessionPdfError((r as any).message || 'PDF failed');
  }

  async function renderFacultyPdfs() {
    setSessionPdfBusy(true); setSessionPdfError(null);
    const r = await generatePDFsForSessionFaculty(session.id);
    setSessionPdfBusy(false);
    if (r.success) {
      const ok = (r as any).results?.filter((x: any) => x.url) || [];
      if (ok.length === 0) setSessionPdfError('No faculty in this session.');
      else setSessionPdfUrl(ok[0].url);
    } else {
      setSessionPdfError((r as any).message || 'PDF failed');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Session</h2>
            <p className="text-sm text-gray-500">{session.session_code}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Session Name</label>
            <input name="session_name" required defaultValue={session.session_name} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
              <select name="session_type" defaultValue={session.session_type || 'Workshop'} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
                <option value="MasterClass">MasterClass</option>
                <option value="Workshop">Workshop</option>
                <option value="Plenary">Plenary</option>
                <option value="Panel">Panel</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Hall</label>
              <input name="hall" defaultValue={session.hall || ''} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. B1" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
            <input name="session_date" type="date" required defaultValue={session.session_date} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TimePicker label="Start Time" h={startH} setH={setStartH} m={startM} setM={setStartM} ampm={startAmPm} setAmPm={setStartAmPm} />
            <TimePicker label="End Time" h={endH} setH={setEndH} m={endM} setM={setEndM} ampm={endAmPm} setAmPm={setEndAmPm} />
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
        {showPostSave && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Session saved</h3>
              <p className="text-sm text-gray-700">
                Session changes saved. Generate PDFs for the whole session, or
                for every faculty member assigned to any topic in it.
              </p>
              {sessionPdfError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{sessionPdfError}</p>}
              {sessionPdfUrl && (
                <p className="text-xs text-green-700 bg-green-50 p-2 rounded">
                  PDF ready:{' '}
                  <a href={sessionPdfUrl} target="_blank" rel="noreferrer" className="underline font-semibold">
                    Open / download
                  </a>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={sessionPdfBusy}
                  onClick={renderSessionPdf}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {sessionPdfBusy ? 'Rendering…' : 'Session PDF'}
                </button>
                <button
                  type="button"
                  disabled={sessionPdfBusy}
                  onClick={renderFacultyPdfs}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {sessionPdfBusy ? 'Rendering…' : 'Faculty PDFs'}
                </button>
              </div>
              <div className="flex justify-end pt-2 border-t">
                <button
                  onClick={() => { setShowPostSave(false); onClose(); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
