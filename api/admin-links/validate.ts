import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const sendJson = (res: VercelResponse, status: number, payload: unknown) => {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
};

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }

  const incomingToken = (req.body?.token || req.query.token) as string | undefined;
  const token = Array.isArray(incomingToken) ? incomingToken[0] : incomingToken;
  if (!token) {
    return sendJson(res, 400, { success: false, error: 'Token is required' });
  }

  const hashedToken = hashToken(String(token));
  const now = new Date().toISOString();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('admin_links').select('id,admin_id,created_by,expires_at,revoked').eq('token_hash', hashedToken).single();
      if (error || !data) {
        return sendJson(res, 401, { success: false, error: 'Invalid admin access link' });
      }
      if (data.revoked || data.expires_at < now) {
        return sendJson(res, 401, { success: false, error: 'Admin access link is revoked or expired' });
      }
      return sendJson(res, 200, { success: true, admin: { id: data.admin_id, email: '', name: 'Admin' } });
    } catch (error: any) {
      console.error('[api/admin-links/validate] failed', error);
      return sendJson(res, 500, { success: false, error: 'Failed to validate viewer link.', details: error?.message || String(error) });
    }
  }

  return sendJson(res, 401, { success: false, error: 'Invalid admin access link' });
}
