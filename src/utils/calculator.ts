import { CalculationResult } from '../types';

export const ANNUAL_INTEREST_RATE = 8.0; // 8% p.a. as featured in EcoCash specs ("Low Rates From 8%")

export function calculateMonthlyPayment(
  principal: number,
  months: number,
  annualRate: number = ANNUAL_INTEREST_RATE
): CalculationResult {
  if (principal <= 0 || months <= 0) {
    return { monthlyPayment: 0, totalInterest: 0, totalRepayment: 0 };
  }

  const monthlyRate = annualRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, months);
  
  if (factor === 1) {
    const monthlyPayment = principal / months;
    return {
      monthlyPayment,
      totalInterest: 0,
      totalRepayment: principal,
    };
  }

  const monthlyPayment = (principal * monthlyRate * factor) / (factor - 1);
  const totalRepayment = monthlyPayment * months;
  const totalInterest = totalRepayment - principal;

  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalRepayment: Math.round(totalRepayment * 100) / 100,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatExactCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
