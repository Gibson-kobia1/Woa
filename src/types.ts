export type AppStep = 'calculator' | 'step1' | 'step2' | 'step3' | 'success' | 'verification';

export interface LoanFormData {
  loanType: string;
  loanAmount: number;
  loanTermMonths: number;
  purpose: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employmentStatus: string;
  annualIncome: number | '';
}

export interface SubmittedApplication extends LoanFormData {
  id: string;
  submittedAt: string;
  monthlyPayment: number;
  status: string;
  verificationCode?: string | null;
}

export interface CalculationResult {
  monthlyPayment: number;
  totalInterest: number;
  totalRepayment: number;
}
