'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import EditFacultyModal from './components/EditFacultyModal';
import FacultyProfileModal from './components/FacultyProfileModal';
import { FileText, Pencil, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Dashboard() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setIsMounted(true);
    async function fetchFaculty() {
      const { data, error } = await supabase
        .from('faculty')
        .select(`*, faculty_topic_counts ( topic_count )`)
        .order('canonical_name');
        
      if (error) console.error(error);
      else setFaculty(data || []);
      setLoading(false);
    }
    fetchFaculty();
  }, []);

  async function refreshFaculty() {
    const { data } = await supabase
      .from('faculty')
      .select(`*, faculty_topic_counts ( topic_count )`)
      .order('canonical_name');
    if (data) setFaculty(data);
  }

  const handleViewPDF = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Just open the API route in a new tab
    window.open(`/api/generate-pdf?id=${id}`, '_blank');
  };

  const filteredFaculty = faculty.filter(doc => 
    doc.canonical_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.faculty_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isMounted) return null;

  return (
    <div className="min-h-[calc(100vh-var(--topbar-h))] bg-muted/40 text-foreground">
      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Faculty Directory</h1>
            <p className="mt-1 text-muted-foreground">
              {loading ? 'Loading…' : `${filteredFaculty.length} of ${faculty.length} people`}
              {' · '}Select a row to view the full profile and schedule.
            </p>
          </div>

          <div className="relative w-full md:w-96">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Search faculty by name, email, or ID"
              placeholder="Search by name, email, or ID..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-semibold sm:px-6">Doctor</th>
                <th scope="col" className="hidden px-6 py-3 font-semibold lg:table-cell">Contact</th>
                <th scope="col" className="hidden px-6 py-3 font-semibold md:table-cell">Role</th>
                <th scope="col" className="hidden px-6 py-3 text-center font-semibold sm:table-cell">Topics</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border" aria-live="polite">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Loading directory...</td></tr>
              ) : filteredFaculty.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No faculty found matching &quot;{searchTerm}&quot;</td></tr>
              ) : (
                filteredFaculty.map((doc) => {
                  const initials = doc.canonical_name?.replace('Dr. ', '').replace('Dr ', '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                  const topicCount = doc.faculty_topic_counts?.[0]?.topic_count || 0;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setViewingProfile(doc)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setViewingProfile(doc);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`View profile of ${doc.canonical_name}`}
                      className="cursor-pointer transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <td className="px-4 py-3 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden="true"
                            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${doc.is_active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0 max-w-[8.5rem] sm:max-w-none">
                            <div className="truncate font-semibold">{doc.canonical_name}</div>
                            <div className="font-mono text-xs text-muted-foreground">{doc.faculty_id}</div>
                            <div className="truncate text-sm text-muted-foreground lg:hidden">{doc.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="hidden px-6 py-3 lg:table-cell">
                        <div className="text-sm">{doc.email}</div>
                        {doc.phone && <div className="mt-0.5 text-xs text-muted-foreground">{doc.phone}</div>}
                      </td>

                      <td className="hidden px-6 py-3 md:table-cell">
                        <div className="flex flex-wrap gap-1.5">
                          {doc.is_faculty && <Badge>Faculty</Badge>}
                          {doc.is_coordinator && <Badge variant="secondary">Coordinator</Badge>}
                        </div>
                      </td>

                      <td className="hidden px-6 py-3 text-center sm:table-cell">
                        <span
                          className={`inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-1 text-sm font-semibold ${topicCount > 0 ? 'border-transparent bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                        >
                          {topicCount}
                        </span>
                      </td>

                      <td className="px-4 py-3 sm:px-6">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); setEditingFaculty(doc); }}
                            aria-label={`Edit ${doc.canonical_name}`}
                            title="Edit faculty"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleViewPDF(doc.id, e)}
                            aria-label={`View PDF for ${doc.canonical_name}`}
                            title="View PDF"
                          >
                            <FileText />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {editingFaculty && (
        <EditFacultyModal
          faculty={editingFaculty}
          onClose={() => setEditingFaculty(null)}
          onSaved={refreshFaculty}
        />
      )}

      {viewingProfile && (
        <FacultyProfileModal
          faculty={viewingProfile}
          onClose={() => setViewingProfile(null)}
        />
      )}
    </div>
  );
}
