import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApplicationRecord, buildApplicationPayloadCandidates } from '../src/utils/supabaseCompat.js';

test('normalizes snake_case and camelCase application rows', () => {
  const row = {
    id: 'ECO-123',
    submitted_at: '2025-01-02T03:04:05.000Z',
    loan_type: 'Personal Loan',
    loan_amount: 12000,
    loan_term: '24 Months',
    first_name: 'Ada',
    last_name: 'Lovelace',
    annual_income: 90000,
    monthly_payment: 550,
    verification_code: 'ABC123',
    status: 'Pre-Approved',
  };

  const normalized = normalizeApplicationRecord(row);

  assert.equal(normalized.id, 'ECO-123');
  assert.equal(normalized.submittedAt, '2025-01-02T03:04:05.000Z');
  assert.equal(normalized.firstName, 'Ada');
  assert.equal(normalized.lastName, 'Lovelace');
  assert.equal(normalized.annualIncome, 90000);
  assert.equal(normalized.verificationCode, 'ABC123');
});

test('builds both snake_case and camelCase payload candidates', () => {
  const payload = buildApplicationPayloadCandidates({
    id: 'ECO-456',
    loanType: 'Personal Loan',
    loanAmount: 8000,
    loanTerm: '12 Months',
    purpose: 'Debt consolidation',
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@example.com',
    phone: '555-0100',
    employmentStatus: 'Employed',
    annualIncome: 110000,
    monthlyPayment: 700,
    status: 'Pre-Approved',
    verificationCode: 'XYZ789',
  }) as Array<Record<string, any>>;

  assert.equal(payload[0].loan_amount, 8000);
  assert.equal(payload[1].loanAmount, 8000);
  assert.equal(payload[0].verification_code, 'XYZ789');
  assert.equal(payload[1].verificationCode, 'XYZ789');
});
