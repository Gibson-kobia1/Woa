import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplicationInsertPayload, buildVerificationCodeUpdatePayload } from '../src/utils/supabaseDirect.js';

test('builds an insert payload for a new application row', () => {
  const payload = buildApplicationInsertPayload({
    loanType: 'Personal Loan',
    loanAmount: 5000,
    loanTermMonths: 12,
    purpose: 'Emergency',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '+254700000000',
    employmentStatus: 'Employed',
    annualIncome: 120000,
    monthlyPayment: 450,
  });

  assert.equal(payload.phone, '+254700000000');
  assert.equal(payload.firstName, 'Ada');
  assert.equal(payload.loanType, 'Personal Loan');
  assert.equal(payload.loanAmount, 5000);
  assert.equal(payload.loanTerm, '12 Months');
  assert.equal(payload.submittedAt, payload.submittedAt);
});

test('builds a verification-code-only update payload', () => {
  const payload = buildVerificationCodeUpdatePayload('1234');

  assert.deepEqual(payload, { verification_code: '1234' });
});
