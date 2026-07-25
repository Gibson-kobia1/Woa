import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

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

type AdminLinkRecord = {
  id: string;
  admin_id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  revoked: boolean;
  revoked_at?: string | null;
  usage_count?: number;
  last_used_at?: string | null;
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

const AdminPage: React.FC<{ onBackToApp: () => void }> = ({ onBackToApp }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [links, setLinks] = useState<AdminLinkRecord[]>([]);
  const [minutes, setMinutes] = useState('30');
  const [hours, setHours] = useState('0');
  const [days, setDays] = useState('0');
  const [exactExpiry, setExactExpiry] = useState('');
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const channelRef = useRef<any>(null);

  const getAuthHeaders = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!supabase) {
      return headers;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch {
      // ignore
    }

    return headers;
  };

  const fetchApplications = async () => {
    setIsLoadingApplications(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/applications?limit=100', { headers });
      if (!res.ok) throw new Error('Unable to load applications');
      const body = await res.json();
      setApplications(sortApplications(body.applications ?? []));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load applications');
      setApplications([]);
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const fetchLinks = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin-links', { headers });
      if (!res.ok) return;
      const body = await res.json();
      setLinks(body.links ?? []);
    } catch {
      // noop
    }
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
        // ignore
      }
    }

    if (supabase) {
      const channel = supabase
        .channel('admin-dashboard-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, (payload: any) => {
          const newApplication = payload.new as ApplicationRecord;
          setApplications((current) => {
            if (current.some((item) => item.id === newApplication.id)) return current;
            return sortApplications([newApplication, ...current]);
          });
        });

      channelRef.current = channel;
      await channel.subscribe();
      return;
    }

    const eventSource = new EventSource('/api/events');
    eventSource.addEventListener('application-created', (event) => {
      const payload = JSON.parse(event.data);
      const newApplication = payload.application as ApplicationRecord;
      setApplications((current) => {
        if (current.some((item) => item.id === newApplication.id)) return current;
        return sortApplications([newApplication, ...current]);
      });
    });
    eventSource.onerror = () => {
      console.warn('[AdminPage] realtime stream disconnected');
      eventSource.close();
    };
    channelRef.current = eventSource;
  };

  useEffect(() => {
    const restoreSession = async () => {
      if (!supabase) {
        setError('Supabase is not configured');
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('[Auth] restoreSession', { session, error });
        if (error) {
          throw error;
        }

        if (!session) {
          setIsLoggedIn(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser(session.access_token);
        if (!user) {
          throw new Error('Unable to restore Supabase session');
        }

        console.log('[Auth] session restored', {
          userId: user.id,
          email: user.email,
          expiresAt: session.expires_at,
        });

        setIsLoggedIn(true);
        await fetchApplications();
        await fetchLinks();
        await connectRealtime();
      } catch (err: any) {
        console.error('[Auth] session restore failed', err);
        setIsLoggedIn(false);
      }
    };

    const { data: authListener } = supabase
      ? supabase.auth.onAuthStateChange((event, session) => {
          console.log('[Auth] auth state change', { event, session });
          if (session) {
            console.log('[Auth] session active', {
              sessionId: session.access_token ? 'present' : 'missing',
              expiresAt: session.expires_at,
            });
            setIsLoggedIn(true);
            void fetchApplications();
            void fetchLinks();
            void connectRealtime();
            return;
          }

          console.log('[Auth] signed out or session expired', { event });
          setIsLoggedIn(false);
          setError(null);
        })
      : { data: null };

    void restoreSession();
    return () => {
      authListener?.subscription?.unsubscribe?.();
      if (channelRef.current) {
        try {
          if (typeof channelRef.current.close === 'function') {
            channelRef.current.close();
          } else if (typeof channelRef.current.unsubscribe === 'function') {
            channelRef.current.unsubscribe();
          }
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (!normalizedUsername || !normalizedPassword) {
      setError('Email and password are required');
      return;
    }

    if (!supabase) {
      setError('Supabase is not configured');
      return;
    }

    try {
      console.log('[Auth] login attempt', { email: normalizedUsername });
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedUsername,
        password: normalizedPassword,
      });
      console.log('[Auth] signInWithPassword result', {
        userId: data?.user?.id || null,
        sessionId: data?.session?.access_token ? 'present' : null,
        expiresAt: data?.session?.expires_at || null,
        error: error?.message || null,
      });

      if (error || !data.session || !data.user) {
        throw error || new Error('Unable to sign in');
      }

      setIsLoggedIn(true);
      await fetchApplications();
      await fetchLinks();
      await connectRealtime();
    } catch (err: any) {
      console.error('[Auth] sign in failed', err);
      setError(err?.message || 'Unable to login');
    }
  };

  const createLink = async () => {
    setIsCreatingLink(true);
    setCreatedLink(null);
    try {
      const payload: Record<string, string | number> = {};
      const headers = await getAuthHeaders();
      if (exactExpiry) {
        payload.expiresAt = exactExpiry;
      } else {
        payload.durationMinutes = Number(minutes || 0);
        payload.durationHours = Number(hours || 0);
        payload.durationDays = Number(days || 0);
      }
      const res = await fetch('/api/admin-links', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Unable to create link');
      setCreatedLink(body.link || null);
      await fetchLinks();
    } catch (err: any) {
      setError(err?.message || 'Unable to create link');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const revokeLink = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin-links/${id}/revoke`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Unable to revoke link');
      await fetchLinks();
    } catch (err: any) {
      setError(err?.message || 'Unable to revoke link');
    }
  };

  const handleBackToApp = async () => {
    if (supabase) {
      try {
        const { error } = await supabase.auth.signOut();
        console.log('[Auth] signOut result', { error });
        if (error) {
          throw error;
        }
      } catch (err: any) {
        console.error('[Auth] signOut failed', err);
      }
    }
    onBackToApp();
  };

  if (!isLoggedIn) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <button type="button" onClick={handleBackToApp} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          ← Back to application
        </button>
        <h2 className="mt-4 text-2xl font-semibold text-slate-900">Admin Login</h2>
        {error ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3" required />
          </div>
          <button type="submit" className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Sign In</button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button type="button" onClick={onBackToApp} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            ← Back to application
          </button>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">Admin dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">Live phone numbers and verification codes from every submission.</p>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">Realtime-ready</div>
      </div>

      {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Applications</h2>
            <span className="text-sm text-slate-500">{applications.length} total</span>
          </div>
          {isLoadingApplications ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Loading submissions…</div>
          ) : applications.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">No submissions yet.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{app.phone || '—'}</p>
                      <p className="text-sm text-slate-600">{[app.firstName, app.lastName].filter(Boolean).join(' ') || 'Unknown applicant'}</p>
                    </div>
                    <div className="text-sm text-slate-500">{app.submittedAt ? formatDateTime(app.submittedAt) : '—'}</div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      <strong className="text-slate-900">Verification code:</strong> {app.verificationCode || app.verification_code || 'Not entered yet'}
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      <strong className="text-slate-900">Email:</strong> {app.email || 'Not provided'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Viewer links</h2>
            <p className="mt-1 text-sm text-slate-500">Create secure shareable links for read-only views.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Minutes</label>
                <input value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Hours</label>
                <input value={hours} onChange={(e) => setHours(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Days</label>
                <input value={days} onChange={(e) => setDays(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-semibold text-slate-700">Exact expiry date/time</label>
              <input type="datetime-local" value={exactExpiry} onChange={(e) => setExactExpiry(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2" />
            </div>
            <button type="button" onClick={createLink} disabled={isCreatingLink} className="mt-4 w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {isCreatingLink ? 'Creating link…' : 'Create viewer link'}
            </button>
            {createdLink ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                <div className="font-semibold">Created link</div>
                <a href={createdLink} target="_blank" rel="noreferrer" className="break-all underline">{createdLink}</a>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            {links.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No links yet.</div>
            ) : (
              links.map((link) => (
                <div key={link.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{link.revoked ? 'Revoked' : 'Active'}</div>
                      <div className="text-slate-500">Expires {formatDateTime(link.expires_at)}</div>
                    </div>
                    <button type="button" onClick={() => revokeLink(link.id)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700">
                      Revoke
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminPage;
