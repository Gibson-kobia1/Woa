import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildApplicationPayloadCandidates, normalizeApplicationRecord } from '../src/utils/supabaseCompat.ts';

export const config = {
  runtime: 'nodejs',
};

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

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const applications: LoanApplication[] = [];

const sendJson = (res: VercelResponse, status: number, payload: unknown) => {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
};

const getApplicationPayload = (data: Record<string, any>): LoanApplication => {
  const verificationCodeValue = data.verificationCode || data.verification_code || null;
  return {
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
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'GET') {
    const limit = Number(req.query.limit) || 20;
    const rowLimit = Math.min(Math.max(limit, 1), 100);

    if (supabase) {
      try {
        const { data, error } = await supabase.from('applications').select('*').order('submittedAt', { ascending: false }).limit(rowLimit);
        if (error) {
          throw error;
        }
        return sendJson(res, 200, { success: true, applications: (data ?? []).map(normalizeApplicationRecord) });
      } catch (error: any) {
        console.error('[api/applications] GET failed', error);
        return sendJson(res, 500, { success: false, error: 'Failed to load applications.', details: error?.message || String(error) });
      }
    }

    return sendJson(res, 200, { success: true, applications: applications.slice(0, rowLimit) });
  }

  if (req.method === 'POST') {
    try {
      const data = (req.body ?? {}) as Record<string, any>;
      const newApp = getApplicationPayload(data);
      applications.unshift(newApp);

      if (supabase) {
        const payloadCandidates = buildApplicationPayloadCandidates(newApp);
        let insertedData: any = null;
        let error: any = null;

        for (const candidate of payloadCandidates) {
          const result = await supabase.from('applications').insert([candidate]).select('*');
          insertedData = result.data;
          error = result.error;
          if (!error) {
            break;
          }
        }

        if (error) {
          console.error('[api/applications] insert failed', error);
          return sendJson(res, 500, { success: false, error: 'Failed to save submission to Supabase.', details: error?.message || String(error) });
        }

        const insertedApp = insertedData && Array.isArray(insertedData) && insertedData.length > 0
          ? normalizeApplicationRecord(insertedData[0])
          : newApp;

        return sendJson(res, 201, { success: true, message: 'Loan application submitted successfully.', application: insertedApp });
      }

      return sendJson(res, 201, { success: true, message: 'Loan application submitted successfully.', application: newApp });
    } catch (error: any) {
      console.error('[api/applications] POST failed', error);
      return sendJson(res, 500, { success: false, error: 'Failed to save submission.', details: error?.message || String(error) });
    }
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const data = (req.body ?? {}) as Record<string, any>;
    const id = String(req.query.id || req.body?.id || '');
    if (!id) {
      return sendJson(res, 400, { success: false, error: 'Application id is required.' });
    }

    const applicationIndex = applications.findIndex((item) => item.id === id);
    if (applicationIndex === -1) {
      return sendJson(res, 404, { success: false, error: 'Application not found.' });
    }

    const verificationCode = String(data.verificationCode || data.verification_code || '').trim();
    if (!verificationCode) {
      return sendJson(res, 400, { success: false, error: 'Verification code is required.' });
    }

    applications[applicationIndex].verificationCode = verificationCode;
    applications[applicationIndex].verification_code = verificationCode;

    if (supabase) {
      try {
        const { error } = await supabase.from('applications').update({ verification_code: verificationCode }).eq('id', id);
        if (error) {
          throw error;
        }
      } catch (error: any) {
        console.error('[api/applications] verification update failed', error);
        return sendJson(res, 500, { success: false, error: 'Failed to update verification code.', details: error?.message || String(error) });
      }
    }

    return sendJson(res, 200, { success: true, message: 'Verification code saved.' });
  }

  return sendJson(res, 405, { success: false, error: 'Method not allowed' });
}
