import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getPublicBaseUrl } from '../_lib/public-url.ts';

export const config = {
  runtime: 'nodejs',
};

interface AdminLinkRecord {
  id: string;
  admin_id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  revoked: boolean;
  revoked_at: string | null;
  token_hash: string;
}

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const localLinks: AdminLinkRecord[] = [];

const sendJson = (res: VercelResponse, status: number, payload: unknown) => {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
};

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('admin_links').select('id,admin_id,created_by,created_at,expires_at,revoked,revoked_at,token_hash').order('created_at', { ascending: false });
        if (error) {
          throw error;
        }
        return sendJson(res, 200, { success: true, links: data ?? [] });
      } catch (error: any) {
        console.error('[api/admin-links] GET failed', error);
        return sendJson(res, 500, { success: false, error: 'Failed to load admin links.', details: error?.message || String(error) });
      }
    }

    return sendJson(res, 200, { success: true, links: localLinks });
  }

  if (req.method === 'POST') {
    try {
      const { durationMinutes, durationHours, durationDays, expiresAt } = (req.body ?? {}) as Record<string, any>;
      let expirationDate: Date | null = null;

      if (expiresAt) {
        expirationDate = new Date(expiresAt);
        if (Number.isNaN(expirationDate.getTime())) {
          return sendJson(res, 400, { success: false, error: 'Invalid expiry date' });
        }
      } else {
        const duration = Number(durationMinutes || 0) + Number(durationHours || 0) * 60 + Number(durationDays || 0) * 1440;
        if (!duration || duration <= 0) {
          return sendJson(res, 400, { success: false, error: 'Duration is required' });
        }
        expirationDate = new Date(Date.now() + duration * 60_000);
      }

      const token = crypto.randomBytes(16).toString('hex');
      const tokenHash = hashToken(token);
      const now = new Date().toISOString();

      if (supabase) {
        const { data, error } = await supabase.from('admin_links').insert([{ admin_id: '00000000-0000-0000-0000-000000000000', created_by: '00000000-0000-0000-0000-000000000000', created_at: now, expires_at: expirationDate.toISOString(), revoked: false, revoked_at: null, token_hash: tokenHash }]).select('*').single();
        if (error || !data) {
          throw error || new Error('Failed to create admin link');
        }
        const baseUrl = getPublicBaseUrl(req);
        const linkUrl = `${baseUrl.replace(/\/$/, '')}/viewer?token=${token}`;
        return sendJson(res, 201, { success: true, link: linkUrl, viewerUrl: linkUrl, token, expiresAt: data.expires_at, expires_at: data.expires_at, id: data.id });
      }

      const newLink: AdminLinkRecord = {
        id: crypto.randomUUID(),
        admin_id: 'local-admin',
        created_by: 'local-admin',
        created_at: now,
        expires_at: expirationDate.toISOString(),
        revoked: false,
        revoked_at: null,
        token_hash: tokenHash,
      };
      localLinks.unshift(newLink);
      const baseUrl = getPublicBaseUrl(req);
      const linkUrl = `${baseUrl.replace(/\/$/, '')}/viewer?token=${token}`;
      return sendJson(res, 201, { success: true, link: linkUrl, viewerUrl: linkUrl, token, expiresAt: newLink.expires_at, expires_at: newLink.expires_at, id: newLink.id });
    } catch (error: any) {
      console.error('[api/admin-links] POST failed', error);
      return sendJson(res, 500, { success: false, error: 'Failed to create viewer link.', details: error?.message || String(error) });
    }
  }

  return sendJson(res, 405, { success: false, error: 'Method not allowed' });
}
