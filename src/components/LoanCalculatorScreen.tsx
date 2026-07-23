import React from 'react';
import { Zap, CircleDollarSign, Lock } from 'lucide-react';
import { calculateMonthlyPayment, formatExactCurrency } from '../utils/calculator';

interface LoanCalculatorScreenProps {
  loanAmount: number;
  setLoanAmount: (val: number) => void;
  loanTermMonths: number;
  setLoanTermMonths: (val: number) => void;
  onApplyNow: () => void;
}

export const LoanCalculatorScreen: React.FC<LoanCalculatorScreenProps> = ({
  loanAmount,
  setLoanAmount,
  loanTermMonths,
  setLoanTermMonths,
  onApplyNow,
}) => {
  const { monthlyPayment } = calculateMonthlyPayment(loanAmount, loanTermMonths);

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Hero Heading */}
      <div className="text-center px-2 pt-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Get Your Loan Approved Fast
        </h1>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Quick approval &bull; Competitive rates &bull; Flexible terms
        </p>
      </div>

      {/* Main Loan Calculator Box */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-2xs">
        <h2 className="text-lg font-bold text-slate-900 text-center mb-6">
          Loan Calculator
        </h2>

        {/* Slider 1: Loan Amount */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-slate-800">Loan Amount</span>
            <span className="font-bold text-blue-600 text-base">
              ${loanAmount.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={5000}
            step={100}
            value={loanAmount}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-hidden"
          />
          <div className="flex justify-between items-center text-xs text-slate-400 font-medium px-0.5">
            <span>$100</span>
            <span>$5,000</span>
          </div>
        </div>

        {/* Slider 2: Loan Term */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-slate-800">Loan Term</span>
            <span className="font-bold text-blue-600 text-base">
              {loanTermMonths} months
            </span>
          </div>
          <input
            type="range"
            min={6}
            max={60}
            step={6}
            value={loanTermMonths}
            onChange={(e) => setLoanTermMonths(Number(e.target.value))}
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-hidden"
          />
          <div className="flex justify-between items-center text-xs text-slate-400 font-medium px-0.5">
            <span>6 months</span>
            <span>60 months</span>
          </div>
        </div>

        {/* Estimated Monthly Payment Box */}
        <div className="bg-blue-50/80 border border-blue-100/90 rounded-2xl p-5 text-center my-4">
          <p className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wider mb-1">
            Monthly Payment
          </p>
          <div className="text-3xl sm:text-4xl font-extrabold text-blue-600 tracking-tight">
            {formatExactCurrency(monthlyPayment)}
          </div>
        </div>
      </div>

      {/* Primary Apply Button */}
      <div>
        <button
          type="button"
          onClick={onApplyNow}
          className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-base rounded-full shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer uppercase tracking-wider text-center"
        >
          APPLY NOW
        </button>
      </div>

      {/* Trust Signals */}
      <div className="grid grid-cols-3 gap-3 pt-3 text-center">
        <div className="flex flex-col items-center space-y-1.5 p-2">
          <div className="w-10 h-10 rounded-full bg-amber-100/80 flex items-center justify-center text-amber-500 mb-0.5">
            <Zap className="w-5 h-5 fill-amber-400 stroke-amber-600" />
          </div>
          <span className="text-xs text-slate-600 font-medium leading-tight max-w-[90px]">
            Fast Approval Within 24 hours
          </span>
        </div>

        <div className="flex flex-col items-center space-y-1.5 p-2">
          <div className="w-10 h-10 rounded-full bg-amber-100/80 flex items-center justify-center text-amber-500 mb-0.5">
            <CircleDollarSign className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-xs text-slate-600 font-medium leading-tight max-w-[90px]">
            Low Rates From 8%
          </span>
        </div>

        <div className="flex flex-col items-center space-y-1.5 p-2">
          <div className="w-10 h-10 rounded-full bg-amber-100/80 flex items-center justify-center text-amber-500 mb-0.5">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-xs text-slate-600 font-medium leading-tight max-w-[90px]">
            Secure Bank-level
          </span>
        </div>
      </div>
    </div>
  );
};
