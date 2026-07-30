import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { normalizeApplicationRecord } from '../utils/supabaseCompat';
import { fetchApplicationsFromSupabase, validateViewerLinkToken } from '../utils/supabaseDirect';

type ApplicationRecord = {
  id: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  verificationCode?: string | null;
  verification_code?: string | null;
  submittedAt?: string | null;
  email?: string | null;
};

const sortApplications = (items: ApplicationRecord[]) =>
  [...items].sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime());

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

interface ViewerPageProps {
  onBackToApp: () => void;
}

const ViewerPage: React.FC<ViewerPageProps> = ({ onBackToApp }) => {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const channelRef = useRef<any>(null);

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const rows = await fetchApplicationsFromSupabase(1000);
      const normalized = (rows ?? []).map((r: any) => normalizeApplicationRecord(r));
      setApplications(sortApplications(normalized));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load applications');
      setApplications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const validateViewerToken = async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('access_token');
    if (!token) {
      setError('Missing viewer token.');
      setIsReady(false);
      return;
    }

    try {
      const link = await validateViewerLinkToken(token);
      if (!link) {
        throw new Error('Invalid or expired viewer link.');
      }
      setIsReady(true);
      await fetchApplications();
    } catch (err: any) {
      setError(err?.message || 'Unable to validate viewer link.');
      setIsReady(false);
    }
  };

  const upsertApplicationInState = (newApplication: ApplicationRecord) => {
    setApplications((current) => {
      const existingIndex = current.findIndex((item) => item.id === newApplication.id);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = { ...next[existingIndex], ...newApplication };
        return sortApplications(next);
      }
      return sortApplications([newApplication, ...current]);
    });
  };

  const connectRealtime = async () => {
    if (channelRef.current) {
      try {
        if (typeof channelRef.current.close === 'function') {
          channelRef.current.close();
        } else if (typeof channelRef.current.unsubscribe === 'function') {
          await channelRef.current.unsubscribe();
        }
      } catch {
        // ignore cleanup errors
      }
    }

    if (!supabase) {
      setError('Supabase is not configured for realtime');
      return;
    }

    const channel = supabase
      .channel('viewer-applications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, (payload: any) => {
        upsertApplicationInState(payload.new as ApplicationRecord);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications' }, (payload: any) => {
        upsertApplicationInState(payload.new as ApplicationRecord);
      });

    channelRef.current = channel;
    await channel.subscribe();
    return;
  };

  useEffect(() => {
    validateViewerToken();
    return () => {
      if (channelRef.current) {
        try {
          if (typeof channelRef.current.close === 'function') {
            channelRef.current.close();
          } else if (typeof channelRef.current.unsubscribe === 'function') {
            channelRef.current.unsubscribe();
          }
        } catch {
          // ignore cleanup errors
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isReady) {
      connectRealtime();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button type="button" onClick={onBackToApp} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
              ← Back to application
            </button>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">Shared admin viewer</h1>
            <p className="mt-2 text-sm text-slate-500">Live submissions visible to everyone with this link.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
            Read-only view
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="mt-6">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Loading submissions…</div>
          ) : applications.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">No submissions yet.</div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{app.phone || '—'}</p>
                      <p className="text-sm text-slate-600">{[app.firstName, app.lastName].filter(Boolean).join(' ') || 'Unknown applicant'}</p>
                    </div>
                    <div className="text-sm text-slate-500">{formatDateTime(app.submittedAt || new Date().toISOString())}</div>
                  </div>
                  <div className="mt-3">
                    <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      <strong className="text-slate-900">Email:</strong> {app.email || 'Not provided'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewerPage;
