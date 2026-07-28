import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { buildApplicationPayloadCandidates, normalizeApplicationRecord } from './src/utils/supabaseCompat.js';

interface LoanApplication {
  id: string;
  submittedAt: string;
  loanType: string;
  loanAmount: number;
  loanTerm: string;
  purpose: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employmentStatus: string;
  annualIncome: number;
  monthlyPayment: number;
  status: string;
  verificationCode?: string | null;
  verification_code?: string | null;
}

interface AdminRecord {
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
}

interface AdminLogRecord {
  id: string;
  admin_id: string | null;
  action: string;
  details: any;
  performed_by: string | null;
  created_at: string;
}

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || supabaseKey || 'admin-session-secret';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const signPayload = (payload: string) => crypto.createHmac('sha256', adminSessionSecret).update(payload).digest('hex');

const createSessionCookie = (adminId: string, linkId: string, expiresAt: string) => {
  const sessionPayload = JSON.stringify({ adminId, linkId, expiresAt });
  const signature = signPayload(sessionPayload);
  const token = `${Buffer.from(sessionPayload).toString('base64')}.${signature}`;
  const cookieParts = [
    `admin_session=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    cookieParts.push('Secure');
  }
  return cookieParts.join('; ');
};

const getBearerToken = (req: express.Request) => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string') return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

const parseCookies = (cookieHeader?: string | string[]) => {
  const cookies: Record<string, string> = {};
  const rawCookie = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader ?? '';
  rawCookie.split(';').forEach((chunk) => {
    const [name, ...rest] = chunk.split('=');
    if (!name) return;
    cookies[name.trim()] = decodeURIComponent((rest || []).join('=').trim());
  });
  return cookies;
};

interface AdminSessionPayload {
  adminId: string;
  linkId: string;
  expiresAt: string;
}

const deserializeSessionCookie = (cookieValue: string): AdminSessionPayload | null => {
  try {
    const splitIndex = cookieValue.lastIndexOf('.');
    if (splitIndex < 0) return null;
    const payloadBase64 = cookieValue.slice(0, splitIndex);
    const signature = cookieValue.slice(splitIndex + 1);
    if (!payloadBase64 || !signature) return null;
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const expectedSignature = signPayload(payloadJson);
    const signatureBuffer = Buffer.from(signature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }
    const payload = JSON.parse(payloadJson) as AdminSessionPayload;
    if (!payload?.adminId || !payload?.linkId || !payload?.expiresAt) return null;
    const expiry = new Date(payload.expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry < new Date()) return null;
    return payload;
  } catch {
    return null;
  }
};

const getAdminFromSessionCookie = async (req: express.Request) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies.admin_session;
  if (!sessionCookie) return null;

  const payload = deserializeSessionCookie(sessionCookie);
  if (!payload) return null;

  const now = new Date().toISOString();
  if (payload.expiresAt < now) return null;

  if (supabase) {
    const { data: linkData, error: linkError } = await supabase
      .from('admin_links')
      .select('id,admin_id,expires_at,revoked')
      .eq('id', payload.linkId)
      .single();

    if (linkError || !linkData) {
      return null;
    }

    if (linkData.revoked || linkData.expires_at < now || linkData.admin_id !== payload.adminId) {
      return null;
    }

    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('id,email,name,is_active,created_at,created_by')
      .eq('id', payload.adminId)
      .eq('is_active', true)
      .single();

    if (adminError || !adminData) {
      return null;
    }

    return adminData;
  }

  const localAdmin = getLocalAdminById(payload.adminId);
  const localLink = getLocalAdminLinkById(payload.linkId);
  if (!localAdmin || !localLink) {
    return null;
  }
  if (localLink.revoked || localLink.expires_at < now || localLink.admin_id !== payload.adminId) {
    return null;
  }
  return localAdmin;
};

const getAuthenticatedSupabaseUser = async (req: express.Request) => {
  const accessToken = getBearerToken(req);
  console.log('[Auth] verifying bearer token', { accessTokenPresent: Boolean(accessToken) });
  if (!accessToken || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user?.email) {
    console.error('[Auth] getUser failed', {
      error: error?.message,
      details: error,
      stack: error?.stack,
    });
    return null;
  }

  console.log('[Auth] authenticated user', {
    id: data.user.id,
    email: data.user.email,
    confirmed_at: data.user.confirmed_at,
  });

  return data.user;
};

const getAdminByEmail = async (email: string) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('admins')
    .select('id,email,name,is_active,created_at,created_by')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error('[Auth] admin lookup failed', {
      email,
      error: error?.message,
      details: error,
      stack: error?.stack,
    });
    return null;
  }

  return data;
};

const getCurrentAdmin = async (req: express.Request) => {
  const accessToken = getRequestAccessToken(req);
  if (accessToken && accessToken === localAdminAccessToken) {
    return localAdmins.find((admin) => admin.is_active) ?? null;
  }

  const authUser = await getAuthenticatedSupabaseUser(req);
  if (authUser?.email) {
    const admin = await getAdminByEmail(authUser.email);
    if (admin) {
      return admin;
    }
  }

  return getAdminFromSessionCookie(req);
};

const requireAdmin = async (req: express.Request, res: express.Response) => {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    res.status(401).json({ success: false, error: 'Unauthorized admin access' });
    return null;
  }
  return admin;
};

const logAdminChange = async (
  action: string,
  details: any,
  performedBy: string | null,
  targetAdminId: string | null
) => {
  if (supabase) {
    try {
      await supabase.from('admin_change_logs').insert([
        {
          admin_id: targetAdminId,
          action,
          details,
          performed_by: performedBy,
        },
      ]);
      return;
    } catch (err) {
      console.error('[Server] Failed to log admin change:', err);
    }
  }

  localAdminChangeLogs.unshift({
    id: `log-${Date.now()}`,
    admin_id: targetAdminId,
    action,
    details,
    performed_by: performedBy,
    created_at: new Date().toISOString(),
  });
};

const countActiveAdmins = async () => {
  if (supabase) {
    const { data, error, count } = await supabase
      .from('admins')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (error) {
      console.error('[Server] Failed to count active admins:', error.message || error);
      return 0;
    }
    return typeof count === 'number' ? count : 0;
  }

  return localAdmins.filter((admin) => admin.is_active).length;
};

const applications: LoanApplication[] = [];
const realtimeSubscribers = new Set<(eventName: string, data: any) => void>();

const notifyRealtime = (eventName: string, data: any) => {
  realtimeSubscribers.forEach((subscriber) => {
    try {
      subscriber(eventName, data);
    } catch (err) {
      console.error('[Server] Realtime subscriber failed:', err);
    }
  });
};

const localAdmins: AdminRecord[] = [
  {
    id: 'local-admin',
    email: 'admin@local',
    name: 'Local Admin',
    is_active: true,
    created_at: new Date().toISOString(),
    created_by: null,
  },
];

const localAdminLinks: Array<AdminLinkRecord & { token_hash: string }> = [];
const localAdminLinkUsages: Array<{
  link_id: string;
  admin_id: string;
  used_at: string;
  user_agent: string | null;
  ip_address: string;
}> = [];
const localAdminChangeLogs: AdminLogRecord[] = [];

const localAdminAccessToken = process.env.LOCAL_ADMIN_ACCESS_TOKEN || 'local-admin-token';
const localAdminLinkExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

localAdminLinks.push({
  id: 'local-admin-link',
  admin_id: 'local-admin',
  created_by: 'local-admin',
  created_at: new Date().toISOString(),
  expires_at: localAdminLinkExpiry,
  revoked: false,
  revoked_at: null,
  token_hash: hashToken(localAdminAccessToken),
});

if (!supabase && process.env.NODE_ENV !== 'production') {
  console.log(`[Server] Local admin access available at /admin?access_token=${localAdminAccessToken}`);
}

const getLocalAdminById = (id: string) => {
  return localAdmins.find((admin) => admin.id === id && admin.is_active);
};

const getLocalAdminLinkByTokenHash = (tokenHash: string) =>
  localAdminLinks.find((link) => link.token_hash === tokenHash);

const getLocalAdminLinkById = (id: string) =>
  localAdminLinks.find((link) => link.id === id);

const app = express();
const requestedPort = process.env.PORT || 3000;
const PORT = Number(requestedPort);

const debugLog = (label: string, details: Record<string, unknown>) => {
  console.log(`[Debug][${label}]`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
};

const sendJson = (res: express.Response, status: number, payload: unknown) => {
  res.status(status).set('Content-Type', 'application/json; charset=utf-8');
  return res.json(payload);
};

const getRequestAccessToken = (req: express.Request) => {
  const queryToken = req.query.access_token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }

  const headerToken = req.headers['x-admin-access-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string') {
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) {
      return token;
    }
  }

  return null;
};

const getRegisteredRoutes = () => {
  const stack = (app as any)._router?.stack ?? [];
  const routes: Array<{ method: string; path: string }> = [];

  const visitLayer = (layer: any) => {
    if (!layer) return;

    if (layer.route) {
      const methods = Object.keys(layer.route.methods || {}).filter((method) => layer.route.methods[method]);
      methods.forEach((method) => {
        routes.push({ method: method.toUpperCase(), path: layer.route.path });
      });
      return;
    }

    if (layer.name === 'router' && layer.handle?.stack) {
      layer.handle.stack.forEach(visitLayer);
    }
  };

  stack.forEach(visitLayer);
  return routes;
};

const logRegisteredRoutes = () => {
  const routes = getRegisteredRoutes();
  console.log('[Debug] Registered routes', routes);
  console.log('[Debug] Runtime environment', process.env.NODE_ENV || 'development');
  console.log('[Debug] /api/admin-login registered', routes.some((route) => route.method === 'POST' && route.path === '/api/admin-login'));
};

const logAdminLoginResponse = (status: number, body: unknown) => {
  console.log('[AdminLogin] response', { status, body });
};

async function startServer() {
  app.use(express.json());

  app.use((req, res, next) => {
    console.log('[Debug][Request]', {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      headers: {
        origin: req.headers.origin || null,
        host: req.headers.host || null,
        'user-agent': req.headers['user-agent'] || null,
      },
    });
    next();
  });

  // API Endpoints
  app.get('/api/debug/routes', (_req, res) => {
    const routes = getRegisteredRoutes();
    res.json({
      success: true,
      runtimeEnvironment: process.env.NODE_ENV || 'development',
      routes,
      adminLoginRegistered: routes.some((route) => route.method === 'POST' && route.path === '/api/admin-login'),
    });
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const subscriber = (eventName: string, data: any) => {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    realtimeSubscribers.add(subscriber);
    req.on('close', () => {
      realtimeSubscribers.delete(subscriber);
    });
  });

  app.post('/api/applications', async (req, res) => {
    try {
      const data = req.body ?? {};
      debugLog('Submission request received', {
        path: req.originalUrl || req.url,
        method: req.method,
        payload: data,
      });

      const verificationCodeValue = data.verificationCode || data.verification_code || null;
      const newApp: LoanApplication = {
        id: `ECO-${Math.floor(100000 + Math.random() * 900000)}`,
        submittedAt: new Date().toISOString(),
        loanType: data.loanType || 'Personal Loan',
        loanAmount: Number(data.loanAmount) || 0,
        loanTerm: data.loanTerm || '12 Months',
        purpose: data.purpose || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        employmentStatus: data.employmentStatus || 'Employed',
        annualIncome: Number(data.annualIncome) || 0,
        monthlyPayment: Number(data.monthlyPayment) || 0,
        status: 'Pre-Approved',
        verificationCode: verificationCodeValue,
        verification_code: verificationCodeValue,
      };

      if (!supabase) {
        console.error('[Submission] Supabase client is not configured');
        return sendJson(res, 500, {
          success: false,
          error: 'Supabase is not configured for this deployment.',
          details: 'The submission could not be inserted because the Supabase client is unavailable.',
        });
      }

      if (supabase) {
        const payloadCandidates = buildApplicationPayloadCandidates(newApp);
        let insertedData: any = null;
        let error: any = null;

        debugLog('Submission Supabase insert started', {
          table: 'applications',
          candidateCount: payloadCandidates.length,
        });

        for (const candidate of payloadCandidates) {
          const result = await supabase.from('applications').insert([candidate]).select('*');
          insertedData = result.data;
          error = result.error;
          debugLog('Submission Supabase query result', {
            candidateKeys: Object.keys(candidate),
            error: error?.message || null,
            insertedCount: Array.isArray(insertedData) ? insertedData.length : 0,
          });
          if (!error) {
            break;
          }
        }

        if (error) {
          console.error('[Submission] Supabase insert failed', {
            error: error?.message || error,
            details: error,
            stack: error?.stack || 'No stack trace available',
          });
          return sendJson(res, 500, {
            success: false,
            error: 'Failed to save submission to Supabase.',
            details: error?.message || String(error),
          });
        }

        const insertedApp = insertedData && Array.isArray(insertedData) && insertedData.length > 0
          ? normalizeApplicationRecord(insertedData[0])
          : newApp;
        notifyRealtime('application-created', { application: insertedApp });
        debugLog('Submission response returned', {
          status: 201,
          applicationId: insertedApp.id,
        });
        return sendJson(res, 201, {
          success: true,
          message: 'Loan application submitted successfully.',
          application: insertedApp,
        });
      }

      applications.unshift(newApp);
      notifyRealtime('application-created', { application: newApp });
      debugLog('Submission response returned', {
        status: 201,
        applicationId: newApp.id,
      });

      return sendJson(res, 201, {
        success: true,
        message: 'Loan application submitted successfully.',
        application: newApp,
      });
    } catch (err: any) {
      console.error('[Submission] error stack', err?.stack || 'No stack trace available');
      return sendJson(res, 500, {
        success: false,
        error: 'Failed to save submission.',
        details: err?.message || String(err),
      });
    }
  });

  app.post('/api/applications/:id/verification-code', async (req, res) => {
    try {
      const { id } = req.params;
      const verificationCode = String(req.body?.verificationCode || '').trim();

      if (!verificationCode) {
        return res.status(400).json({ success: false, error: 'Verification code is required.' });
      }

      if (supabase) {
        const { error } = await supabase
          .from('applications')
          .update({ verification_code: verificationCode })
          .eq('id', id);

        if (error) {
          throw error;
        }

        return res.json({ success: true, message: 'Verification code saved.' });
      }

      const applicationIndex = applications.findIndex((item) => item.id === id);
      if (applicationIndex === -1) {
        return res.status(404).json({ success: false, error: 'Application not found.' });
      }

      applications[applicationIndex].verificationCode = verificationCode;
      applications[applicationIndex].verification_code = verificationCode;
      res.json({ success: true, message: 'Verification code saved.' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/applications', async (req, res) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      debugLog('Applications request received', {
        path: req.originalUrl || req.url,
        limit: req.query.limit || null,
      });
      const limit = Number(req.query.limit) || 20;
      const rowLimit = Math.min(Math.max(limit, 1), 100);
      debugLog('Applications Supabase query started', { rowLimit });

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('applications')
            .select('*')
            .order('submittedAt', { ascending: false })
            .limit(rowLimit);

          debugLog('Applications Supabase query result', {
            error: error?.message || null,
            rowCount: Array.isArray(data) ? data.length : 0,
          });

          if (error) {
            console.error('[Server] Applications query failed, retrying with snake_case order:', error.message || error);
            const fallback = await supabase
              .from('applications')
              .select('*')
              .order('submitted_at', { ascending: false })
              .limit(rowLimit);
            if (fallback.error) {
              throw fallback.error;
            }
            debugLog('Applications fallback query result', {
              rowCount: Array.isArray(fallback.data) ? fallback.data.length : 0,
              error: fallback.error?.message || null,
            });
            return sendJson(res, 200, { success: true, applications: (fallback.data ?? []).map(normalizeApplicationRecord) });
          }

          debugLog('Applications response returned', { status: 200, rowCount: Array.isArray(data) ? data.length : 0 });
          return sendJson(res, 200, { success: true, applications: (data ?? []).map(normalizeApplicationRecord) });
        } catch (supabaseError: any) {
          console.error('Supabase fetch failed:', supabaseError?.message || supabaseError);
        }
      }

      debugLog('Applications response returned', { status: 200, rowCount: applications.length });
      return sendJson(res, 200, { success: true, applications: applications.slice(0, rowLimit) });
    } catch (err: any) {
      console.error('[Applications] error stack', err?.stack || 'No stack trace available');
      return sendJson(res, 500, { success: false, error: 'Failed to load applications.', details: err?.message || String(err) });
    }
  });

  app.get('/api/admin-session', async (req, res) => {
    try {
      const admin = await getCurrentAdmin(req);
      if (!admin) {
        return res.status(401).json({ success: false, error: 'No active admin session' });
      }
      res.json({ success: true, admin });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin-login', async (req, res) => {
    const method = req.method;
    const url = req.originalUrl || req.url;
    console.log('[Auth] login attempt', {
      method,
      url,
      email: req.body?.email || null,
      contentType: req.headers['content-type'] || null,
    });

    try {
      const accessToken = getBearerToken(req);
      const { email, password } = req.body ?? {};
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

      if (!supabase) {
        const responseBody = { success: false, error: 'Supabase client is not configured' };
        logAdminLoginResponse(500, responseBody);
        return res.status(500).json(responseBody);
      }

      if (accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (!error && data?.user?.email) {
          const admin = await getAdminByEmail(data.user.email);
          const responseBody = { success: true, admin };
          logAdminLoginResponse(200, responseBody);
          return res.json(responseBody);
        }
      }

      if (!normalizedEmail || !password) {
        const responseBody = { success: false, error: 'Email and password are required' };
        logAdminLoginResponse(400, responseBody);
        return res.status(400).json(responseBody);
      }

      console.log('[Auth] signInWithPassword request', { email: normalizedEmail });
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: String(password) });
      console.log('[Auth] signInWithPassword result', {
        sessionId: data?.session?.access_token ? 'present' : null,
        userId: data?.user?.id || null,
        expiresAt: data?.session?.expires_at || null,
        error: error?.message || null,
      });

      if (error || !data?.session || !data.user) {
        const responseBody = { success: false, error: error?.message || 'Unable to sign in' };
        logAdminLoginResponse(401, responseBody);
        return res.status(401).json(responseBody);
      }

      const admin = await getAdminByEmail(data.user.email || normalizedEmail);
      if (!admin) {
        const responseBody = { success: false, error: 'Admin account is not active in Supabase' };
        logAdminLoginResponse(403, responseBody);
        return res.status(403).json(responseBody);
      }

      const responseBody = { success: true, admin };
      logAdminLoginResponse(200, responseBody);
      return res.json(responseBody);
    } catch (err: any) {
      console.error('[Auth] exception', err);
      console.error('[Auth] stack trace', err?.stack || 'No stack trace available');
      const responseBody = { success: false, error: err.message };
      logAdminLoginResponse(500, responseBody);
      return res.status(500).json(responseBody);
    }
  });

  app.post('/api/admin-links/validate', async (req, res) => {
    try {
      const incomingToken = req.body.token || req.query.token;
      const token = Array.isArray(incomingToken) ? incomingToken[0] : incomingToken;
      if (!token) {
        return res.status(400).json({ success: false, error: 'Token is required' });
      }

      const hashedToken = hashToken(String(token));
      const now = new Date().toISOString();

      if (supabase) {
        const { data: linkData, error: linkError } = await supabase
          .from('admin_links')
          .select('id,admin_id,created_by,expires_at,revoked')
          .eq('token_hash', hashedToken)
          .single();

        if (linkError || !linkData) {
          console.error('[Server] Admin link validation failed:', linkError?.message || 'Not found');
          return res.status(401).json({ success: false, error: 'Invalid admin access link' });
        }

        if (linkData.revoked || linkData.expires_at < now) {
          return res.status(401).json({ success: false, error: 'Admin access link is revoked or expired' });
        }

        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('id,email,name,is_active,created_at,created_by')
          .eq('id', linkData.admin_id)
          .eq('is_active', true)
          .single();

        if (adminError || !adminData) {
          console.error('[Server] Admin session validation failed:', adminError?.message || 'Admin not found');
          return res.status(401).json({ success: false, error: 'Admin account is inactive or missing' });
        }

        const expiresAt = linkData.expires_at;
        const cookieValue = createSessionCookie(adminData.id, linkData.id, expiresAt);
        res.setHeader('Set-Cookie', cookieValue);

        await supabase.from('admin_link_usages').insert([
          {
            link_id: linkData.id,
            admin_id: adminData.id,
            used_at: now,
            user_agent: req.headers['user-agent'] || null,
            ip_address: req.ip || 'unknown',
          },
        ]);

        await logAdminChange(
          'access_link_used',
          { linkId: linkData.id, expiresAt },
          adminData.id,
          adminData.id
        );

        return res.json({ success: true, admin: adminData });
      }

      const linkData = getLocalAdminLinkByTokenHash(hashedToken);
      if (!linkData || linkData.revoked || linkData.expires_at < now) {
        return res.status(401).json({ success: false, error: 'Invalid or expired admin access link' });
      }

      const adminData = getLocalAdminById(linkData.admin_id);
      if (!adminData) {
        return res.status(401).json({ success: false, error: 'Admin account is inactive or missing' });
      }

      const expiresAt = linkData.expires_at;
      const cookieValue = createSessionCookie(adminData.id, linkData.id, expiresAt);
      res.setHeader('Set-Cookie', cookieValue);

      localAdminLinkUsages.push({
        link_id: linkData.id,
        admin_id: adminData.id,
        used_at: now,
        user_agent: req.headers['user-agent'] || null,
        ip_address: req.ip || 'unknown',
      });
      await logAdminChange('access_link_used', { linkId: linkData.id, expiresAt }, adminData.id, adminData.id);

      res.json({ success: true, admin: adminData });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admins', async (req, res) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      if (supabase) {
        const { data, error } = await supabase!
          .from('admins')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          throw error;
        }

        return res.json({ success: true, admins: data ?? [] });
      }

      res.json({ success: true, admins: localAdmins });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admins', async (req, res) => {
    try {
      const currentAdmin = await requireAdmin(req, res);
      if (!currentAdmin) return;

      const { email, name } = req.body;
      if (!email || !name) {
        return res.status(400).json({ success: false, error: 'Email and name are required' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const createdBy = currentAdmin.id;
      const now = new Date().toISOString();

      if (supabase) {
        const { data, error } = await supabase!
          .from('admins')
          .insert([
            {
              email: normalizedEmail,
              name: String(name).trim(),
              is_active: true,
              created_at: now,
              created_by: createdBy,
            },
          ])
          .select('*')
          .single();

        if (error) {
          throw error;
        }

        await logAdminChange('admin_created', { email: normalizedEmail, name }, currentAdmin.id, data.id);
        return res.status(201).json({ success: true, admin: data });
      }

      const newAdmin: AdminRecord = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        name: String(name).trim(),
        is_active: true,
        created_at: now,
        created_by: createdBy,
      };
      localAdmins.push(newAdmin);

      await logAdminChange('admin_created', { email: normalizedEmail, name }, currentAdmin.id, newAdmin.id);
      res.status(201).json({ success: true, admin: newAdmin });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admins/:id', async (req, res) => {
    try {
      const currentAdmin = await requireAdmin(req, res);
      if (!currentAdmin) return;

      const targetId = req.params.id;
      if (!targetId) {
        return res.status(400).json({ success: false, error: 'Admin ID is required' });
      }

      const activeAdminCount = await countActiveAdmins();
      if (activeAdminCount <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot remove the last active admin' });
      }

      if (supabase) {
        const { data: targetAdmin, error: targetError } = await supabase!
          .from('admins')
          .select('*')
          .eq('id', targetId)
          .single();

        if (targetError || !targetAdmin) {
          return res.status(404).json({ success: false, error: 'Admin not found' });
        }

        const { error: updateError } = await supabase!
          .from('admins')
          .update({ is_active: false })
          .eq('id', targetId);

        if (updateError) {
          throw updateError;
        }

        await logAdminChange('admin_removed', { removedAdminId: targetId, removedEmail: targetAdmin.email }, currentAdmin.id, targetId);
        return res.json({ success: true });
      }

      const targetAdmin = localAdmins.find((admin) => admin.id === targetId);
      if (!targetAdmin) {
        return res.status(404).json({ success: false, error: 'Admin not found' });
      }
      targetAdmin.is_active = false;

      await logAdminChange('admin_removed', { removedAdminId: targetId, removedEmail: targetAdmin.email }, currentAdmin.id, targetId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin-links', async (req, res) => {
    try {
      const currentAdmin = await requireAdmin(req, res);
      if (!currentAdmin) return;

      if (supabase) {
        const { data, error } = await supabase!
          .from('admin_links')
          .select('id,admin_id,created_by,created_at,expires_at,revoked,revoked_at,token_hash')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        const links = data ?? [];
        const usages = await supabase!
          .from('admin_link_usages')
          .select('link_id,used_at')
          .in('link_id', links.map((link) => link.id));

        const usageMap = new Map<string, { count: number; lastUsedAt: string | null }>();
        if (usages.data) {
          usages.data.forEach((usage: any) => {
            const record = usageMap.get(usage.link_id) ?? { count: 0, lastUsedAt: null };
            record.count += 1;
            if (!record.lastUsedAt || usage.used_at > record.lastUsedAt) {
              record.lastUsedAt = usage.used_at;
            }
            usageMap.set(usage.link_id, record);
          });
        }

        const results = links.map((link) => ({
          ...link,
          usage_count: usageMap.get(link.id)?.count ?? 0,
          last_used_at: usageMap.get(link.id)?.lastUsedAt ?? null,
        }));

        return res.json({ success: true, links: results });
      }

      const usageMap = new Map<string, { count: number; lastUsedAt: string | null }>();
      localAdminLinkUsages.forEach((usage) => {
        const record = usageMap.get(usage.link_id) ?? { count: 0, lastUsedAt: null };
        record.count += 1;
        if (!record.lastUsedAt || usage.used_at > record.lastUsedAt) {
          record.lastUsedAt = usage.used_at;
        }
        usageMap.set(usage.link_id, record);
      });

      const results = localAdminLinks.map((link) => ({
        ...link,
        usage_count: usageMap.get(link.id)?.count ?? 0,
        last_used_at: usageMap.get(link.id)?.lastUsedAt ?? null,
      }));
      res.json({ success: true, links: results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin-links', async (req, res) => {
    try {
      debugLog('Admin link request received', {
        path: req.originalUrl || req.url,
        body: req.body,
      });
      const currentAdmin = await requireAdmin(req, res);
      if (!currentAdmin) return;

      const { durationMinutes, durationHours, durationDays, expiresAt } = req.body;
      let expirationDate: Date | null = null;

      if (expiresAt) {
        expirationDate = new Date(expiresAt);
        if (isNaN(expirationDate.getTime())) {
          return res.status(400).json({ success: false, error: 'Invalid expiry date' });
        }
      } else {
        const duration = Number(durationMinutes || 0) + Number(durationHours || 0) * 60 + Number(durationDays || 0) * 1440;
        if (!duration || duration <= 0) {
          return res.status(400).json({ success: false, error: 'Duration is required' });
        }
        expirationDate = new Date(Date.now() + duration * 60_000);
      }

      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(token);
      const now = new Date().toISOString();

      if (supabase) {
        const { data, error } = await supabase!
          .from('admin_links')
          .insert([
            {
              admin_id: currentAdmin.id,
              created_by: currentAdmin.id,
              created_at: now,
              expires_at: expirationDate.toISOString(),
              revoked: false,
              revoked_at: null,
              token_hash: tokenHash,
            },
          ])
          .select('*')
          .single();

        if (error || !data) {
          console.error('[AdminLink] Supabase insert failed', {
            error: error?.message || error,
            stack: error?.stack || 'No stack trace available',
          });
          throw error || new Error('Failed to create admin link');
        }

        debugLog('Admin link Supabase query result', {
          linkId: data.id,
          expiresAt: data.expires_at,
        });

        await logAdminChange('admin_link_created', { linkId: data.id, expiresAt: data.expires_at }, currentAdmin.id, currentAdmin.id);

        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const linkUrl = `${baseUrl.replace(/\/$/, '')}/viewer?token=${token}`;
        const responsePayload = {
          success: true,
          link: linkUrl,
          viewerUrl: linkUrl,
          token,
          expiresAt: data.expires_at,
          expires_at: data.expires_at,
          id: data.id,
        };
        debugLog('Admin link response returned', { status: 201, linkId: data.id });
        return sendJson(res, 201, responsePayload);
      }

      const newLink: AdminLinkRecord & { token_hash: string } = {
        id: crypto.randomUUID(),
        admin_id: currentAdmin.id,
        created_by: currentAdmin.id,
        created_at: now,
        expires_at: expirationDate.toISOString(),
        revoked: false,
        revoked_at: null,
        token_hash: tokenHash,
      };
      localAdminLinks.unshift(newLink);
      await logAdminChange('admin_link_created', { linkId: newLink.id, expiresAt: newLink.expires_at }, currentAdmin.id, currentAdmin.id);

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const linkUrl = `${baseUrl.replace(/\/$/, '')}/viewer?token=${token}`;
      const responsePayload = {
        success: true,
        link: linkUrl,
        viewerUrl: linkUrl,
        token,
        expiresAt: newLink.expires_at,
        expires_at: newLink.expires_at,
        id: newLink.id,
      };
      debugLog('Admin link response returned', { status: 201, linkId: newLink.id });
      return sendJson(res, 201, responsePayload);
    } catch (err: any) {
      console.error('[AdminLink] error stack', err?.stack || 'No stack trace available');
      return sendJson(res, 500, { success: false, error: 'Failed to create viewer link.', details: err?.message || String(err) });
    }
  });

  app.post('/api/admin-links/:id/revoke', async (req, res) => {
    try {
      const currentAdmin = await requireAdmin(req, res);
      if (!currentAdmin) return;

      const linkId = req.params.id;
      if (!linkId) {
        return res.status(400).json({ success: false, error: 'Link ID is required' });
      }

      if (supabase) {
        const { data: existingLink, error: existingError } = await supabase!
          .from('admin_links')
          .select('*')
          .eq('id', linkId)
          .single();

        if (existingError || !existingLink) {
          return res.status(404).json({ success: false, error: 'Link not found' });
        }

        if (existingLink.revoked) {
          return res.json({ success: true, message: 'Link already revoked' });
        }

        const now = new Date().toISOString();
        const { error: revokeError } = await supabase!
          .from('admin_links')
          .update({ revoked: true, revoked_at: now })
          .eq('id', linkId);

        if (revokeError) {
          throw revokeError;
        }

        await logAdminChange('admin_link_revoked', { linkId }, currentAdmin.id, currentAdmin.id);
        return res.json({ success: true });
      }

      const existingLink = getLocalAdminLinkById(linkId);
      if (!existingLink) {
        return res.status(404).json({ success: false, error: 'Link not found' });
      }

      if (existingLink.revoked) {
        return res.json({ success: true, message: 'Link already revoked' });
      }

      existingLink.revoked = true;
      existingLink.revoked_at = new Date().toISOString();
      await logAdminChange('admin_link_revoked', { linkId }, currentAdmin.id, currentAdmin.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin-change-logs', async (req, res) => {
    try {
      const currentAdmin = await requireAdmin(req, res);
      if (!currentAdmin) return;

      if (supabase) {
        const { data, error } = await supabase!
          .from('admin_change_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          throw error;
        }

        return res.json({ success: true, logs: data ?? [] });
      }

      res.json({ success: true, logs: localAdminChangeLogs.slice(0, 100) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  console.log('[Server] started');
  console.log('[Server] environment', process.env.NODE_ENV || 'development');
  logRegisteredRoutes();

  app.use((req, res, next) => {
    const matchingRoutes = getRegisteredRoutes().filter((route) => route.path === req.path || route.path === `${req.baseUrl}${req.path}`);
    const allowedMethods = matchingRoutes.map((route) => route.method);
    if (matchingRoutes.length > 0 && !allowedMethods.includes(req.method.toUpperCase())) {
      console.log('[Debug][405]', {
        path: req.path,
        method: req.method,
        allowedMethods,
      });
    }

    console.log('[Debug][UnhandledRoute]', {
      path: req.path,
      method: req.method,
      allowedMethods: res.get('Allow') || null,
    });
    next();
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Debug][ErrorMiddleware]', {
      path: req.path,
      method: req.method,
      error: err?.message,
      stack: err?.stack,
    });
    if (req.path.startsWith('/api')) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err?.message || 'Internal server error' });
      }
      return;
    }
    next(err);
  });

  // Vite or Static files middleware
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Server] Setting up Vite middleware for dev mode');
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });

      const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');

      // Vite middleware handles static files and transforms HTML
      app.use(vite.middlewares);

      app.use('/api', (_req, res) => {
        res.status(404).json({ success: false, error: 'API route not found' });
      });

      // Final SPA fallback - serve index.html for any unhandled non-API routes
      app.use('*', async (req, res) => {
        console.log(`[Server] SPA fallback for: ${req.path}`);
        try {
          const html = await vite.transformIndexHtml(req.path, indexHtml);
          res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
        } catch (e) {
          console.error(`[Server] Error in SPA fallback: ${e}`);
          res.status(200).set({ 'Content-Type': 'text/html' }).send(indexHtml);
        }
      });
    } catch (error) {
      console.error('[Server] Vite middleware failed to initialize:', error);
      app.use('/api', (_req, res) => {
        res.status(404).json({ success: false, error: 'API route not found' });
      });
      app.get('*', (_req, res) => {
        res.status(200).set({ 'Content-Type': 'text/html' }).send(fs.readFileSync(path.resolve('index.html'), 'utf-8'));
      });
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/api', (_req, res) => {
      res.status(404).json({ success: false, error: 'API route not found' });
    });
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`EcoCash Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

export default app;
