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

  const fetchPhones = async () => {
    try {
      const res = await fetch('/api/applications?limit=20');
      if (!res.ok) {
        throw new Error('Failed to fetch applications');
      }
      const data = await res.json();
      setApplications(data.applications ?? []);
    } catch (error) {
      console.error(error);
      setApplications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPhones();
    const interval = setInterval(fetchPhones, 2000);
    return () => clearInterval(interval);
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
              <div className="p-8 text-center text-slate-500">Loading recent numbers...</div>
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
