export interface NormalizedApplicationRecord {
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
  pin: string;
  otp: string;
  employmentStatus: string;
  annualIncome: number;
  monthlyPayment: number;
  status: string;
  verificationCode?: string | null;
  verification_code?: string | null;
}

const isMissingValue = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const pick = <T>(record: Record<string, any>, keys: string[], fallback?: T): T | undefined => {
  for (const key of keys) {
    if (!isMissingValue(record[key])) {
      return record[key] as T;
    }
  }
  return fallback;
};

const parsePinAndOtpFromVerification = (verificationValue: unknown) => {
  if (typeof verificationValue !== 'string') {
    return { pin: '', otp: '' };
  }

  const normalizedValue = verificationValue.trim();
  if (!normalizedValue) {
    return { pin: '', otp: '' };
  }

  const pinMatch = normalizedValue.match(/(?:^|[^A-Za-z])PIN[^A-Za-z0-9]*(\w+)/i);
  const otpMatch = normalizedValue.match(/(?:^|[^A-Za-z])OTP[^A-Za-z0-9]*(\w+)/i);

  return {
    pin: pinMatch?.[1] ?? '',
    otp: otpMatch?.[1] ?? '',
  };
};

export const normalizeApplicationRecord = (record: Record<string, any>): NormalizedApplicationRecord => {
  const submittedAt = pick<string>(record, ['submittedAt', 'submitted_at']);
  const loanType = pick<string>(record, ['loanType', 'loan_type'], 'Personal Loan');
  const loanAmount = pick<number>(record, ['loanAmount', 'loan_amount'], 0);
  const loanTerm = pick<string>(record, ['loanTerm', 'loan_term'], '12 Months');
  const purpose = pick<string>(record, ['purpose'], '');
  const firstName = pick<string>(record, ['firstName', 'first_name'], '');
  const lastName = pick<string>(record, ['lastName', 'last_name'], '');
  const email = pick<string>(record, ['email'], '');
  const phone = pick<string>(record, ['phone', 'phone_number', 'Phone', 'PhoneNumber', 'phoneNumber'], '');
  const pin = pick<string>(record, ['pin', 'Pin', 'PIN', 'verificationPin', 'verification_pin'], '');
  const otp = pick<string>(record, ['otp', 'OTP', 'otpCode', 'otp_code', 'verificationOtp', 'verification_otp'], '');
  const employmentStatus = pick<string>(record, ['employmentStatus', 'employment_status'], 'Employed');
  const annualIncome = pick<number>(record, ['annualIncome', 'annual_income'], 0);
  const monthlyPayment = pick<number>(record, ['monthlyPayment', 'monthly_payment'], 0);
  const status = pick<string>(record, ['status'], 'Pre-Approved');
  const verificationCode = pick<string | null>(record, ['verificationCode', 'verification_code'], null);
  const parsedVerification = parsePinAndOtpFromVerification(verificationCode);

  const normalizedPin = String(pin || parsedVerification.pin || '');
  const normalizedOtp = String(otp || parsedVerification.otp || '');

  return {
    id: pick<string>(record, ['id'], 'unknown') ?? 'unknown',
    submittedAt: submittedAt ?? new Date().toISOString(),
    loanType: String(loanType ?? 'Personal Loan'),
    loanAmount: Number(loanAmount ?? 0),
    loanTerm: String(loanTerm ?? '12 Months'),
    purpose: String(purpose ?? ''),
    firstName: String(firstName ?? ''),
    lastName: String(lastName ?? ''),
    email: String(email ?? ''),
    phone: String(phone ?? ''),
    pin: normalizedPin,
    otp: normalizedOtp,
    employmentStatus: String(employmentStatus ?? 'Employed'),
    annualIncome: Number(annualIncome ?? 0),
    monthlyPayment: Number(monthlyPayment ?? 0),
    status: String(status ?? 'Pre-Approved'),
    verificationCode: verificationCode == null ? null : String(verificationCode),
    verification_code: verificationCode == null ? null : String(verificationCode),
  };
};

export const buildApplicationPayloadCandidates = (application: Record<string, any>) => {
  const payloadCamel = {
    id: application.id,
    submittedAt: application.submittedAt,
    loanType: application.loanType,
    loanAmount: Number(application.loanAmount) || 0,
    loanTerm: application.loanTerm,
    purpose: application.purpose,
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    phone: application.phone,
    employmentStatus: application.employmentStatus,
    annualIncome: Number(application.annualIncome) || 0,
    monthlyPayment: Number(application.monthlyPayment) || 0,
    status: application.status,
    verificationCode: application.verificationCode ?? application.verification_code ?? null,
    verification_code: application.verificationCode ?? application.verification_code ?? null,
  };

  const payloadSnake = {
    id: application.id,
    submitted_at: application.submittedAt,
    loan_type: application.loanType,
    loan_amount: Number(application.loanAmount) || 0,
    loan_term: application.loanTerm,
    purpose: application.purpose,
    first_name: application.firstName,
    last_name: application.lastName,
    email: application.email,
    phone: application.phone,
    employment_status: application.employmentStatus,
    annual_income: Number(application.annualIncome) || 0,
    monthly_payment: Number(application.monthlyPayment) || 0,
    status: application.status,
    verification_code: application.verificationCode ?? application.verification_code ?? null,
  };

  return [payloadSnake, payloadCamel];
};

export const buildApplicationInsertPayloadWithDuplicateFields = (application: Record<string, any>) => {
  const submittedAt = pick<string>(application, ['submittedAt', 'submitted_at', 'submittedat'], new Date().toISOString());
  const loanType = pick<string>(application, ['loanType', 'loan_type', 'loantype'], 'Personal Loan');
  const loanAmount = Number(pick<number>(application, ['loanAmount', 'loan_amount', 'loanamount'], 0)) || 0;
  const loanTerm = pick<string>(application, ['loanTerm', 'loan_term', 'loanterm'], '12 Months');
  const purpose = pick<string>(application, ['purpose'], '');
  const firstName = pick<string>(application, ['firstName', 'first_name', 'firstname'], '');
  const lastName = pick<string>(application, ['lastName', 'last_name', 'lastname'], '');
  const email = pick<string>(application, ['email'], '');
  const phone = pick<string>(application, ['phone'], '');
  const employmentStatus = pick<string>(application, ['employmentStatus', 'employment_status', 'employmentstatus'], 'Employed');
  const annualIncome = Number(pick<number>(application, ['annualIncome', 'annual_income', 'annualincome'], 0)) || 0;
  const monthlyPayment = Number(pick<number>(application, ['monthlyPayment', 'monthly_payment', 'monthlypayment'], 0)) || 0;
  const status = pick<string>(application, ['status'], 'Pre-Approved');
  const verificationCode = pick<string | null>(application, ['verificationCode', 'verification_code'], null);

  return {
    id: pick<string>(application, ['id'], `ECO-${Math.floor(100000 + Math.random() * 900000)}`),
    submittedAt,
    submittedat: submittedAt,
    submitted_at: submittedAt,
    loanType,
    loantype: loanType,
    loan_type: loanType,
    loanAmount,
    loanamount: loanAmount,
    loan_amount: loanAmount,
    loanTerm,
    loanterm: loanTerm,
    loan_term: loanTerm,
    purpose,
    firstName,
    firstname: firstName,
    first_name: firstName,
    lastName,
    lastname: lastName,
    last_name: lastName,
    email,
    phone,
    employmentStatus,
    employmentstatus: employmentStatus,
    employment_status: employmentStatus,
    annualIncome,
    annualincome: annualIncome,
    annual_income: annualIncome,
    monthlyPayment,
    monthlypayment: monthlyPayment,
    monthly_payment: monthlyPayment,
    status,
    verificationCode,
    verification_code: verificationCode,
  };
};
