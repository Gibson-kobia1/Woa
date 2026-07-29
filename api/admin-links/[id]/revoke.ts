import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'nodejs',
};

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const sendJson = (res: VercelResponse, status: number, payload: unknown) => {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }

  const id = String(req.query.id || '');
  if (!id) {
    return sendJson(res, 400, { success: false, error: 'Link id is required.' });
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('admin_links').update({ revoked: true, revoked_at: new Date().toISOString() }).eq('id', id);
      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('[api/admin-links/[id]/revoke] failed', error);
      return sendJson(res, 500, { success: false, error: 'Failed to revoke link.', details: error?.message || String(error) });
    }
  }

  return sendJson(res, 200, { success: true });
}
