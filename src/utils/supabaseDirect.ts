import { supabase } from '../supabaseClient';
import type { LoanFormData } from '../types';

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
  verification_code: verificationCode,
});

export const createApplicationInSupabase = async (payload: DirectApplicationInsertPayload) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { data, error } = await supabase
    .from('applications')
    .insert(payload)
    .select()
    .single();

  if (error) {
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
    .order('submittedAt', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
};
