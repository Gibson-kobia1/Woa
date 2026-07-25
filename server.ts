import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';

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

const parseSessionCookie = (req: express.Request) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce<Record<string, string>>((acc, cookie) => {
    const [key, ...rest] = cookie.split('=');
    const value = rest.join('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const rawSession = cookies.admin_session;
  if (!rawSession) return null;

  const [encodedPayload, signature] = rawSession.split('.');
  if (!encodedPayload || !signature) return null;

  const payload = Buffer.from(encodedPayload, 'base64').toString('utf-8');
  const expectedSignature = signPayload(payload);
  if (expectedSignature !== signature) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload);
    if (!parsed.adminId || !parsed.linkId || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) return null;
    return parsed as { adminId: string; linkId: string; expiresAt: string };
  } catch {
    return null;
  }
};

const getCurrentAdmin = async (req: express.Request) => {
  const session = parseSessionCookie(req);
  if (!session) return null;

  const now = new Date().toISOString();
  if (supabase) {
    const { data: linkData, error: linkError } = await supabase
      .from<AdminLinkRecord>('admin_links')
      .select('admin_id,revoked,expires_at')
      .eq('id', session.linkId)
      .single();

    if (linkError || !linkData || linkData.revoked || linkData.expires_at < now) {
      return null;
    }

    if (linkData.admin_id !== session.adminId) {
      return null;
    }

    const { data: adminData, error: adminError } = await supabase
      .from<AdminRecord>('admins')
      .select('id,email,name,is_active,created_at,created_by')
      .eq('id', session.adminId)
      .eq('is_active', true)
      .single();

    if (adminError || !adminData) {
      return null;
    }

    return adminData;
  }

  const linkData = getLocalAdminLinkById(session.linkId);
  if (!linkData || linkData.revoked || linkData.expires_at < now) {
    return null;
  }

  if (linkData.admin_id !== session.adminId) {
    return null;
  }

  return getLocalAdminById(session.adminId) || null;
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
      .from<AdminRecord>('admins')
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

const getLocalAdminById = (id: string) =>
  localAdmins.find((admin) => admin.id === id && admin.is_active);

const getLocalAdminLinkByTokenHash = (tokenHash: string) =>
  localAdminLinks.find((link) => link.token_hash === tokenHash);

const getLocalAdminLinkById = (id: string) =>
  localAdminLinks.find((link) => link.id === id);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // API Endpoints
  app.post('/api/applications', async (req, res) => {
    try {
      const data = req.body;
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

      if (supabase) {
        const { data: insertedData, error } = (await supabase
          .from('applications')
          .insert([newApp])) as any;

        if (error) {
          throw error;
        }

        const insertedApp = insertedData && Array.isArray(insertedData) && insertedData.length > 0 ? insertedData[0] : newApp;
        res.status(201).json({
          success: true,
          message: 'Loan application submitted successfully.',
          application: insertedApp,
        });
        return;
      }

      applications.unshift(newApp);

      res.status(201).json({
        success: true,
        message: 'Loan application submitted successfully.',
        application: newApp,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
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
      console.log('[API] Fetching applications with query:', req.query);
      const limit = Number(req.query.limit) || 20;
      const rowLimit = Math.min(Math.max(limit, 1), 100);
      console.log('[API] Row limit:', rowLimit);

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('applications')
            .select('*')
            .order('submittedAt', { ascending: false })
            .limit(rowLimit);

          if (error) {
            throw error;
          }

          res.json({ success: true, applications: data ?? [] });
          return;
        } catch (supabaseError: any) {
          console.error('Supabase fetch failed:', supabaseError?.message || supabaseError);
        }
      }

      res.json({ success: true, applications: applications.slice(0, rowLimit) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
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
            ip_address: req.ip,
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
        ip_address: req.ip,
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
          .from<AdminRecord>('admins')
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
          .from<AdminRecord>('admins')
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
          .from<AdminRecord>('admins')
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
          throw error || new Error('Failed to create admin link');
        }

        await logAdminChange('admin_link_created', { linkId: data.id, expiresAt: data.expires_at }, currentAdmin.id, currentAdmin.id);

        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const linkUrl = `${baseUrl.replace(/\/$/, '')}/admin?access_token=${token}`;

        return res.status(201).json({ success: true, link: linkUrl, expires_at: data.expires_at, id: data.id });
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
      const linkUrl = `${baseUrl.replace(/\/$/, '')}/admin?access_token=${token}`;
      return res.status(201).json({ success: true, link: linkUrl, expires_at: newLink.expires_at, id: newLink.id });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
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
          .from<AdminLogRecord>('admin_change_logs')
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

  // Vite or Static files middleware
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Server] Setting up Vite middleware for dev mode');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');

    // Vite middleware handles static files and transforms HTML
    app.use(vite.middlewares);

    // Final SPA fallback - serve index.html for any unhandled routes
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
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EcoCash Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
