import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';

type Application = {
  id: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  verificationCode?: string | null;
  verification_code?: string | null;
  submittedAt?: string | null;
};

const AdminPage: React.FC = () => {
  const [admin, setAdmin] = useState<any | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);

  const [links, setLinks] = useState<any[]>([]);
  const [newLinkDays, setNewLinkDays] = useState('0');
  const [newLinkHours, setNewLinkHours] = useState('1');
  const [newLinkMinutes, setNewLinkMinutes] = useState('0');
  const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null);
  const realtimeChannel = useRef<any | null>(null);

  const fetchApplications = async () => {
    setIsLoadingApplications(true);
    try {
      const res = await fetch('/api/applications?limit=100');
      if (!res.ok) throw new Error('Failed to fetch applications');
      const body = await res.json();
      setApplications((body.applications || []).slice(0, 200));
    } catch (err: any) {
      console.error('[AdminPage] fetchApplications error', err);
      setApplications([]);
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const fetchAdminSession = async () => {
    setSessionLoading(true);
    try {
      const res = await fetch('/api/admin-session');
      if (!res.ok) {
        setAdmin(null);
        setSessionLoading(false);
        return;
      }
      const body = await res.json();
      if (body?.admin) setAdmin(body.admin);
    } catch (err: any) {
      console.error('[AdminPage] session check failed', err);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoginError(null);
    setSessionLoading(true);
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setLoginError(body?.error || 'Invalid credentials');
        return;
      }
      setAdmin(body.admin);
      setLoginUsername('');
      setLoginPassword('');
      fetchApplications();
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed');
    } finally {
      setSessionLoading(false);
    }
  };

  const validateAccessToken = async (token: string) => {
    setSessionLoading(true);
    try {
      const res = await fetch('/api/admin-links/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) {
        console.error('[AdminPage] access token validation failed', body?.error);
        setSessionLoading(false);
        return;
      }
      setAdmin(body.admin);
      fetchApplications();
    } catch (err: any) {
      console.error('[AdminPage] validateAccessToken error', err);
    } finally {
      setSessionLoading(false);
    }
  };

  const setupRealtime = async () => {
    if (!supabase) return;
    try {
      // unsubscribe existing
      if (realtimeChannel.current) {
        try { await realtimeChannel.current.unsubscribe(); } catch { /* ignore */ }
        realtimeChannel.current = null;
      }

      const channel = supabase.channel('realtime-applications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, (payload: any) => {
          const ev = payload.eventType;
          const newRecord = payload.new as Application | null;
          const oldRecord = payload.old as Application | null;

          setApplications((cur) => {
            if (ev === 'INSERT' && newRecord) {
              return [newRecord, ...cur];
            }
            if ((ev === 'UPDATE' || ev === 'DELETE') && newRecord) {
              return cur.map((r) => (r.id === newRecord.id ? { ...r, ...newRecord } : r));
            }
            return cur;
          });
        })
        .on('open', () => console.log('[AdminPage] Realtime open'))
        .on('close', () => console.log('[AdminPage] Realtime closed'));

      realtimeChannel.current = channel;
      const { error } = await channel.subscribe();
      if (error) console.error('[AdminPage] realtime subscribe error', error.message || error);
    } catch (err) {
      console.error('[AdminPage] setupRealtime error', err);
    }
  };

  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/admin-links');
      if (!res.ok) return;
      const body = await res.json();
      setLinks(body.links || []);
    } catch (err) {
      console.error('[AdminPage] fetchLinks error', err);
    }
  };

  const createLink = async () => {
    setCreatedLinkUrl(null);
    try {
      const res = await fetch('/api/admin-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: Number(newLinkDays), durationHours: Number(newLinkHours), durationMinutes: Number(newLinkMinutes) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Failed to create link');
      setCreatedLinkUrl(body.link || null);
      fetchLinks();
    } catch (err: any) {
      console.error('[AdminPage] createLink error', err);
      setCreatedLinkUrl(null);
    }
  };

  useEffect(() => {
    // if access_token in query, try validate; otherwise check session
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('access_token');
      if (token) {
        validateAccessToken(token);
        return;
      }
    }
    fetchAdminSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (admin) {
      fetchApplications();
      fetchLinks();
      setupRealtime();
    }
    return () => {
      if (realtimeChannel.current) {
        try { realtimeChannel.current.unsubscribe(); } catch { /* ignore */ }
        realtimeChannel.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  if (sessionLoading) {
    return <div>Checking admin session…</div>;
  }

  if (!admin) {
    return (
      <div style={{ maxWidth: 760, margin: '24px auto', padding: 20 }}>
        <h2>Admin Sign In</h2>
        {loginError && <div style={{ color: 'red' }}>{loginError}</div>}
        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12 }}>
          <div>
            <label>Username</label>
            <input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
          </div>
          <div>
            <button type="submit">Sign in</button>
          </div>
        </form>
        <hr style={{ margin: '16px 0' }} />
        <div>
          <p>Or access with a link containing an <em>access_token</em> query parameter.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '16px auto', padding: 20 }}>
      <h1>Admin Dashboard — {admin?.name || admin?.email}</h1>

      <section style={{ marginTop: 16 }}>
        <h2>Generate Access Link</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={newLinkDays} onChange={(e) => setNewLinkDays(e.target.value)} style={{ width: 60 }} /> days
          <input value={newLinkHours} onChange={(e) => setNewLinkHours(e.target.value)} style={{ width: 60 }} /> hours
          <input value={newLinkMinutes} onChange={(e) => setNewLinkMinutes(e.target.value)} style={{ width: 60 }} /> minutes
          <button onClick={createLink}>Create link</button>
        </div>
        {createdLinkUrl && (
          <div style={{ marginTop: 8 }}>
            <strong>Link:</strong> <a href={createdLinkUrl}>{createdLinkUrl}</a>
          </div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Live Applications</h2>
        {isLoadingApplications ? (
          <div>Loading…</div>
        ) : applications.length === 0 ? (
          <div>No applications yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {applications.map((app) => (
              <div key={app.id} style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
                <div><strong>Phone:</strong> {app.phone || '—'}</div>
                <div><strong>Name:</strong> {app.firstName} {app.lastName}</div>
                <div><strong>Code:</strong> {app.verificationCode || app.verification_code || '—'}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{app.submittedAt}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminPage;
