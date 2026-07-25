import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Phone, Clock, Lock, Users, Link2, Plus, Trash2, RefreshCcw } from 'lucide-react';
import { supabase } from '../supabaseClient';

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
  verificationCode?: string | null;
  verification_code?: string | null;
}

interface AdminSession {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

interface AdminLinkRecord {
  id: string;
  admin_id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  revoked: boolean;
  revoked_at: string | null;
  usage_count: number;
  last_used_at: string | null;
  link?: string;
}

const sortApplications = (items: ApplicationRecord[]) => {
  return [...items].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const AdminPage: React.FC<AdminPageProps> = ({ onBackToApp }) => {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [admins, setAdmins] = useState<AdminSession[]>([]);
  const [links, setLinks] = useState<AdminLinkRecord[]>([]);
  const [logs, setLogs] = useState<Array<{ id: string; action: string; details: any; performed_by: string | null; created_at: string }>>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newLinkDays, setNewLinkDays] = useState('0');
  const [newLinkHours, setNewLinkHours] = useState('1');
  const [newLinkMinutes, setNewLinkMinutes] = useState('0');
  const [managementMessage, setManagementMessage] = useState<string | null>(null);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const realtimeChannel = useRef<any>(null);

  const queryAccessToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('access_token');
  }, []);

  const fetchApplications = async () => {
    try {
      setIsLoadingApplications(true);
      const res = await fetch('/api/applications?limit=20');
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(errorBody || 'Unable to load applications');
      }

      const data = await res.json();
      setApplications(sortApplications(data.applications ?? []));
      setApplicationError(null);
    } catch (err: any) {
      setApplicationError(err?.message || 'Failed to load applications');
      setApplications([]);
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const fetchAdminSession = async () => {
    setSessionLoading(true);
    try {
      setSessionError(null);
      const res = await fetch('/api/admin-session');
      if (!res.ok) {
        return;
      }
      const body = await res.json();
      if (body?.admin) {
        setAdmin(body.admin);
        setSessionError(null);
      }
    } catch (err: any) {
      setSessionError(err?.message || 'Failed to validate admin session.');
    } finally {
      setSessionLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setLoginError(null);
    setSessionLoading(true);
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUsername.trim(),
          password: adminPassword.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setLoginError(body?.error || 'Invalid admin credentials.');
        return;
      }
      setAdmin(body.admin);
      setSessionError(null);
      setAdminUsername('');
      setAdminPassword('');
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/admin');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Failed to login.');
    } finally {
      setSessionLoading(false);
    }
  };

  const validateAccessToken = async (token: string) => {
    setIsValidatingToken(true);
    try {
      const res = await fetch('/api/admin-links/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const body = await res.json();
      if (!res.ok) {
        setSessionError(body?.error || 'Invalid or expired admin access token');
        setAdmin(null);
        return;
      }

      setAdmin(body.admin);
      setSessionError(null);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/admin');
      }
    } catch (err: any) {
      setSessionError(err?.message || 'Failed to validate access token');
    } finally {
      setIsValidatingToken(false);
      setSessionLoading(false);
    }
  };

  const fetchAdminData = async () => {
    if (!admin) return;
    try {
      const [adminsRes, linksRes, logsRes] = await Promise.all([
        fetch('/api/admins'),
        fetch('/api/admin-links'),
        fetch('/api/admin-change-logs'),
      ]);

      if (adminsRes.ok) {
        const data = await adminsRes.json();
        setAdmins(data.admins ?? []);
      }

      if (linksRes.ok) {
        const data = await linksRes.json();
        setLinks(data.links ?? []);
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs ?? []);
      }
    } catch (err: any) {
      console.error('[AdminPage] fetchAdminData error', err);
      setManagementMessage('Unable to load admin management data.');
    }
  };

  const createAdmin = async () => {
    if (!newAdminEmail || !newAdminName) {
      setManagementMessage('Please provide a name and email for the new admin.');
      return;
    }

    setIsCreatingAdmin(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail.trim(), name: newAdminName.trim() }),
      });

      const body = await res.json();
      if (!res.ok) {
        setManagementMessage(body?.error || 'Failed to add admin');
        return;
      }

      setAdmins((current) => [...current, body.admin]);
      setNewAdminEmail('');
      setNewAdminName('');
      setManagementMessage('Admin invited successfully.');
    } catch (err: any) {
      setManagementMessage(err?.message || 'Failed to create admin');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const removeAdmin = async (adminId: string) => {
    try {
      const res = await fetch(`/api/admins/${adminId}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) {
        setManagementMessage(body?.error || 'Failed to remove admin');
        return;
      }
      setAdmins((current) => current.filter((item) => item.id !== adminId));
      setManagementMessage('Admin removed successfully.');
    } catch (err: any) {
      setManagementMessage(err?.message || 'Failed to remove admin');
    }
  };

  const createAdminLink = async () => {
    setIsCreatingLink(true);
    setManagementMessage(null);
    try {
      const res = await fetch('/api/admin-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationDays: Number(newLinkDays),
          durationHours: Number(newLinkHours),
          durationMinutes: Number(newLinkMinutes),
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setManagementMessage(body?.error || 'Failed to create access link');
        return;
      }

      setLinks((current) => [
        {
          ...body,
          usage_count: 0,
          last_used_at: null,
        } as AdminLinkRecord,
        ...current,
      ]);
      setManagementMessage('Admin access link created.');
    } catch (err: any) {
      setManagementMessage(err?.message || 'Failed to create access link');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const revokeLink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/admin-links/${linkId}/revoke`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setManagementMessage(body?.error || 'Failed to revoke link');
        return;
      }

      setLinks((current) =>
        current.map((link) =>
          link.id === linkId ? { ...link, revoked: true, revoked_at: new Date().toISOString() } : link
        )
      );
      setManagementMessage('Access link revoked.');
    } catch (err: any) {
      setManagementMessage(err?.message || 'Failed to revoke link');
    }
  };

  const setupRealtime = async () => {
    if (!supabase) {
      setRealtimeError('Realtime is not configured. Install Supabase keys to enable live updates.');
      return;
    }

    const channel = supabase
      .channel('realtime-applications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'applications' },
        (payload) => {
          const newRecord = payload.new as ApplicationRecord;
          setApplications((current) => {
            if (current.some((item) => item.id === newRecord.id)) {
              return current;
            }
            return sortApplications([newRecord, ...current]);
          });
        }
      )
      .on('open', () => setRealtimeError(null))
      .on('close', () => console.log('[AdminPage] Realtime disconnected'))
      .on('error', (error) => {
        console.error('[AdminPage] Realtime error', error);
        setRealtimeError('Realtime connection failed.');
      });

    realtimeChannel.current = channel;
    const { error } = await channel.subscribe();
    if (error) {
      setRealtimeError(error.message || 'Realtime subscription failed');
    }
  };

  useEffect(() => {
    if (queryAccessToken) {
      validateAccessToken(queryAccessToken);
    } else {
      fetchAdminSession();
    }
  }, [queryAccessToken]);

  useEffect(() => {
    if (admin) {
      fetchApplications();
      fetchAdminData();
      setupRealtime();
    }
  }, [admin]);

  useEffect(() => {
    return () => {
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
      }
    };
  }, []);

  const applicationCount = applications.length;
  const activeAdminCount = admins.filter((item) => item.is_active).length;
  const activeLinkCount = links.filter((item) => !item.revoked && new Date(item.expires_at) > new Date()).length;

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-100/90 flex items-center justify-center p-4">
        <div className="rounded-3xl bg-white p-10 shadow-lg border border-slate-200 text-center">
          <p className="text-lg font-semibold text-slate-900">Checking admin session…</p>
          <p className="mt-3 text-slate-500">One moment while we verify your access.</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="min-h-screen bg-slate-100/90 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-[30px] bg-white border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Loan Application
            </button>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-slate-500 text-xs font-semibold uppercase tracking-[0.2em]">
              <Lock className="w-4 h-4" /> Admin Login
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-lg font-semibold text-slate-900">Admin Sign In</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Enter the hardcoded admin credentials to access the dashboard.
              </p>
            </div>

            {(sessionError || loginError) && (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {loginError || sessionError}
              </div>
            )}

            <div className="grid gap-4">
              <div className="rounded-3xl border border-slate-200 p-6">
                <label className="block text-sm font-semibold text-slate-700">Username</label>
                <input
                  value={adminUsername}
                  onChange={(event) => setAdminUsername(event.target.value)}
                  placeholder="venomous"
                  className="mt-3 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="rounded-3xl border border-slate-200 p-6">
                <label className="block text-sm font-semibold text-slate-700">Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="venomous99"
                  className="mt-3 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAdminLogin}
              className="mt-4 w-full inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {sessionLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col items-center justify-start p-4 py-10">
      <div className="w-full max-w-7xl space-y-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <button
                type="button"
                onClick={onBackToApp}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Loan Application
              </button>
              <p className="mt-4 text-sm uppercase tracking-[0.24em] text-slate-500">Admin dashboard</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">Welcome, {admin.name}</h1>
              <p className="mt-2 text-sm text-slate-500">{admin.email} · Active since {formatDateTime(admin.created_at)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Applications</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{applicationCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Admins</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{activeAdminCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Open links</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{activeLinkCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">Live phone feed</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">Recent applications</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-slate-500 text-xs font-semibold uppercase tracking-[0.2em]">
                  <Clock className="w-4 h-4" /> Live updates
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Latest phone</p>
                <p className="mt-4 text-4xl font-extrabold text-slate-900">
                  {isLoadingApplications ? 'Loading...' : applications[0]?.phone || 'No phone entered yet'}
                </p>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">
                  Recent phone numbers
                </div>
                {isLoadingApplications ? (
                  <div className="p-8 text-center text-slate-500">Loading recent numbers…</div>
                ) : applicationError ? (
                  <div className="p-8 text-center text-red-600">
                    <p>Failed to load applications</p>
                    <p className="text-xs mt-2">{applicationError}</p>
                    <button
                      onClick={fetchApplications}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-white text-xs font-semibold hover:bg-blue-700"
                    >
                      <RefreshCcw className="w-4 h-4" /> Retry
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
                          <p className="mt-1 text-xs text-slate-500">
                            Verification code: {app.verificationCode || app.verification_code || 'Not entered yet'}
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

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">Audit log</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">Recent admin events</h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <Users className="w-4 h-4" /> {logs.length}
                </span>
              </div>

              {logs.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No recent admin change logs available.
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {logs.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{entry.action}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(entry.created_at)}</p>
                      <p className="mt-2 text-slate-600">Performed by {entry.performed_by || 'system'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">Admin management</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">Admins</h2>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="grid gap-3">
                  <label className="text-sm font-semibold text-slate-700">Name</label>
                  <input
                    value={newAdminName}
                    onChange={(event) => setNewAdminName(event.target.value)}
                    className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Admin name"
                  />
                  <label className="text-sm font-semibold text-slate-700">Email</label>
                  <input
                    value={newAdminEmail}
                    onChange={(event) => setNewAdminEmail(event.target.value)}
                    className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="admin@example.com"
                  />
                </div>
                <button
                  type="button"
                  onClick={createAdmin}
                  disabled={isCreatingAdmin}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus className="w-4 h-4" /> Add admin
                </button>

                {managementMessage && (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    {managementMessage}
                  </div>
                )}
              </div>

              <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">
                  Active admins
                </div>
                {admins.length === 0 ? (
                  <div className="p-6 text-sm text-slate-500">No admins found.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {admins.map((item) => (
                      <div key={item.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-green-700">{item.is_active ? 'Active' : 'Inactive'}</span>
                          {item.id !== admin.id && item.is_active && (
                            <button
                              type="button"
                              onClick={() => removeAdmin(item.id)}
                              className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">Access links</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">Secure admin login links</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="grid gap-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                    <label className="text-sm font-semibold text-slate-700">Days</label>
                    <label className="text-sm font-semibold text-slate-700">Hours</label>
                    <input
                      value={newLinkDays}
                      onChange={(event) => setNewLinkDays(event.target.value)}
                      className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      inputMode="numeric"
                    />
                    <input
                      value={newLinkHours}
                      onChange={(event) => setNewLinkHours(event.target.value)}
                      className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      inputMode="numeric"
                    />
                    <label className="text-sm font-semibold text-slate-700">Minutes</label>
                    <input
                      value={newLinkMinutes}
                      onChange={(event) => setNewLinkMinutes(event.target.value)}
                      className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={createAdminLink}
                  disabled={isCreatingLink}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus className="w-4 h-4" /> Create access link
                </button>
              </div>

              <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">
                  Generated links
                </div>
                {links.length === 0 ? (
                  <div className="p-6 text-sm text-slate-500">No admin access links generated yet.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {links.map((link) => (
                      <div key={link.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{link.revoked ? 'Revoked link' : 'Active link'}</p>
                          <p className="text-xs text-slate-500">Expires {formatDateTime(link.expires_at)}</p>
                          <p className="mt-1 text-xs text-slate-500">Used {link.usage_count} times</p>
                          {link.last_used_at && <p className="mt-1 text-xs text-slate-500">Last used {formatDateTime(link.last_used_at)}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!link.link}
                            onClick={() => link.link && navigator.clipboard.writeText(link.link)}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${link.link ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                          >
                            Copy link
                          </button>
                          {!link.revoked && (
                            <button
                              type="button"
                              onClick={() => revokeLink(link.id)}
                              className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Revoke
                            </button>
                          )}
                        </div>
                        {link.link && (
                          <p className="mt-2 text-[11px] text-slate-500 truncate">Link available for the newly created token.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
