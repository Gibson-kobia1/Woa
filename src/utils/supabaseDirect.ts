import { supabase } from '../supabaseClient';
import type { LoanFormData } from '../types';
import { buildApplicationInsertPayloadWithDuplicateFields } from './supabaseCompat';

export type DirectApplicationInsertPayload = {
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
  verificationCode: string | null;
  verification_code: string | null;
};

export type ViewerLinkRecord = {
  id: string;
  admin_id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  revoked: boolean;
  revoked_at?: string | null;
  token_hash: string;
};

const hashValue = async (value: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const ensureAdminRecordExists = async (userId: string, userEmail: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { error } = await supabase.from('admins').upsert(
    {
      id: userId,
      email: userEmail || 'admin@example.com',
      name: userEmail || 'Admin',
      created_by: userId,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw error;
  }
};

export const buildApplicationInsertPayload = (input: LoanFormData & { monthlyPayment: number; submittedAt?: string; id?: string; verificationCode?: string | null }) => {
  const submittedAt = input.submittedAt ?? new Date().toISOString();

  return {
    id: input.id ?? `ECO-${Math.floor(100000 + Math.random() * 900000)}`,
    submittedAt,
    loanType: input.loanType,
    loanAmount: Number(input.loanAmount) || 0,
    loanTerm: `${input.loanTermMonths} Months`,
    purpose: input.purpose,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    employmentStatus: input.employmentStatus,
    annualIncome: Number(input.annualIncome) || 0,
    monthlyPayment: Number(input.monthlyPayment) || 0,
    status: 'Pre-Approved',
    verificationCode: input.verificationCode ?? null,
    verification_code: input.verificationCode ?? null,
  } satisfies DirectApplicationInsertPayload;
};

export const buildVerificationCodeUpdatePayload = (verificationCode: string) => ({
  verificationCode: verificationCode,
  verification_code: verificationCode,
  verificationcode: verificationCode,
});

export const createApplicationInSupabase = async (payload: DirectApplicationInsertPayload) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const payloadWithId = {
    ...payload,
    submittedAt: payload.submittedAt ?? new Date().toISOString(),
  };

  const insertPayload = buildApplicationInsertPayloadWithDuplicateFields(payloadWithId as Record<string, any>);

  const { data, error } = await supabase
    .from('applications')
    .insert(insertPayload as Record<string, any>)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const createViewerLinkInSupabase = async (payload: {
  durationMinutes: number;
  durationHours: number;
  durationDays: number;
  expiresAt?: string;
}) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session || !sessionData.session.user) {
    throw sessionError || new Error('Admin session is required to create viewer links.');
  }

  const user = sessionData.session.user;
  const userId = user.id;
  await ensureAdminRecordExists(userId, user.email ?? 'admin@example.com');

  const expiresAt = payload.expiresAt
    ? new Date(payload.expiresAt)
    : new Date(Date.now() + ((payload.durationDays * 24 + payload.durationHours) * 60 + payload.durationMinutes) * 60 * 1000);

  const token = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await hashValue(token);

  const { data, error } = await supabase.from('admin_links').insert([{
    id: crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join(''),
    admin_id: userId,
    created_by: userId,
    expires_at: expiresAt.toISOString(),
    revoked: false,
    token_hash: tokenHash,
  }]).select().single();

  if (error || !data) {
    throw error || new Error('Failed to create viewer link.');
  }

  const baseUrl = window.location.origin;
  return {
    ...data,
    token,
    viewerUrl: `${baseUrl}/viewer?token=${encodeURIComponent(token)}`,
  };
};

export const fetchViewerLinksFromSupabase = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session || !sessionData.session.user) {
    throw sessionError || new Error('Admin session is required to fetch viewer links.');
  }

  const userId = sessionData.session.user.id;
  const { data, error } = await supabase
    .from('admin_links')
    .select('*')
    .eq('admin_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const revokeViewerLinkInSupabase = async (id: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { data, error } = await supabase
    .from('admin_links')
    .update({ revoked: true, revoked_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const validateViewerLinkToken = async (token: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const tokenHash = await hashValue(token);
  const { data, error } = await supabase
    .from('admin_links')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('revoked', false)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116' || error.code === 'PGRST102') {
      return null;
    }
    throw error;
  }

  return data;
};

export const updateApplicationVerificationCodeInSupabase = async (applicationId: string, verificationCode: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { data, error } = await supabase
    .from('applications')
    .update(buildVerificationCodeUpdatePayload(verificationCode))
    .eq('id', applicationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const fetchApplicationsFromSupabase = async (limit = 1000) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
};
