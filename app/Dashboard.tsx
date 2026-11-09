'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { generateAndEmailPDF } from './actions';
import EditFacultyModal from './components/EditFacultyModal';

export default function Dashboard() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);

  useEffect(() => {
    setIsMounted(true);
    async function fetchFaculty() {
      const { data, error } = await supabase.from('faculty').select('*');
      if (error) console.error(error);
      else setFaculty(data || []);
      setLoading(false);
    }
    fetchFaculty();
  }, []);

  async function refreshFaculty() {
    const { data, error } = await supabase.from('faculty').select('*');
    if (error) console.error(error);
    else setFaculty(data || []);
  }

  const handleGeneratePDF = async (id: string) => {
    const confirmSend = window.confirm("Do you want to generate the PDF and send the email?");
    if (!confirmSend) return;

    try {
      const result = await generateAndEmailPDF(id);
      if (result.success) {
        alert(result.message);
      } else {
        alert("Error: " + result.message);
      }
    } catch (err: any) {
      alert("Failed to connect to server: " + err.message);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <span className="text-xl font-bold text-blue-600">DERMACON 2028</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <a href="#" className="block px-4 py-2 bg-blue-50 text-blue-700 rounded-md font-medium">Dashboard</a>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-4">Faculty Dashboard</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                <th className="px-6 py-4 font-medium">Doctor Name</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={3} className="text-center py-8 text-gray-500">Loading...</td></tr>
              ) : (
                faculty.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-6 py-4 font-medium">{doc.canonical_name}</td>
                    <td className="px-6 py-4 text-gray-600">{doc.email}</td>
<td className="px-6 py-4 text-right">
  <div className="flex justify-end gap-2">
    <button
      onClick={() => setEditingFaculty(doc)}
      className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm"
    >
      Edit
    </button>
    <button
      onClick={() => handleGeneratePDF(doc.id)}
      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
    >
      Generate PDF
    </button>
  </div>
</td>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingFaculty(doc)}
                          className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleGeneratePDF(doc.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                        >
                          Generate PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
    </div>
  );
}