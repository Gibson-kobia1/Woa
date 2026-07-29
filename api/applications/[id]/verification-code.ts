import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'nodejs',
};

interface LoanApplication {
  id: string;
  verificationCode?: string | null;
  verification_code?: string | null;
}

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const applications: LoanApplication[] = [];

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
  const verificationCode = String((req.body as Record<string, any> | undefined)?.verificationCode || '').trim();
  if (!id) {
    return sendJson(res, 400, { success: false, error: 'Application id is required.' });
  }
  if (!verificationCode) {
    return sendJson(res, 400, { success: false, error: 'Verification code is required.' });
  }

  const applicationIndex = applications.findIndex((item) => item.id === id);
  if (applicationIndex >= 0) {
    applications[applicationIndex].verificationCode = verificationCode;
    applications[applicationIndex].verification_code = verificationCode;
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('applications').update({ verification_code: verificationCode }).eq('id', id);
      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('[api/applications/[id]/verification-code] failed', error);
      return sendJson(res, 500, { success: false, error: 'Failed to save verification code.', details: error?.message || String(error) });
    }
  }

  return sendJson(res, 200, { success: true, message: 'Verification code saved.' });
}
