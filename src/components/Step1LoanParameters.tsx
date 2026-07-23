import React, { useState } from 'react';
import { LoanFormData } from '../types';

interface Step1Props {
  formData: LoanFormData;
  updateFormData: (fields: Partial<LoanFormData>) => void;
  onNext: () => void;
}

export const Step1LoanParameters: React.FC<Step1Props> = ({
  formData,
  updateFormData,
  onNext,
}) => {
  const [errors, setErrors] = useState<{ amount?: string; purpose?: string }>({});

  const loanTypeOptions = [
    'Personal Loan',
    'Business Loan',
    'Education Loan',
    'Emergency Loan',
    'Debt Consolidation',
    'Home Improvement',
  ];

  const loanTermOptions = [
    { label: '6 Months', value: 6 },
    { label: '12 Months', value: 12 },
    { label: '24 Months', value: 24 },
    { label: '36 Months', value: 36 },
    { label: '48 Months', value: 48 },
    { label: '60 Months', value: 60 },
  ];

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { amount?: string; purpose?: string } = {};

    if (!formData.loanAmount || formData.loanAmount < 100) {
      newErrors.amount = 'Loan amount must be at least $100';
    }

    if (!formData.purpose || formData.purpose.trim().length < 2) {
      newErrors.purpose = 'Please specify the purpose of the loan';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onNext();
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      {/* Step Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Loan Application
        </h2>
        <p className="text-sm font-medium text-slate-500">Step 1 of 3</p>
      </div>

      <form onSubmit={handleNext} className="space-y-5 pt-2">
        {/* 1. Loan Type Dropdown */}
        <div className="space-y-1.5">
          <label htmlFor="loanType" className="block text-sm font-semibold text-slate-800">
            Loan Type
          </label>
          <div className="relative">
            <select
              id="loanType"
              value={formData.loanType}
              onChange={(e) => updateFormData({ loanType: e.target.value })}
              className="w-full bg-slate-100/80 border border-slate-200 text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white appearance-none cursor-pointer pr-10 font-medium"
            >
              {loanTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 2. Loan Amount ($) */}
        <div className="space-y-1.5">
          <label htmlFor="loanAmount" className="block text-sm font-semibold text-slate-800">
            Loan Amount ($)
          </label>
          <input
            id="loanAmount"
            type="number"
            min={100}
            max={50000}
            value={formData.loanAmount || ''}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateFormData({ loanAmount: val });
              if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            placeholder="e.g. 4733"
            className={`w-full bg-slate-50 border ${
              errors.amount ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'
            } text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:bg-white font-medium`}
          />
          {errors.amount && (
            <p className="text-xs text-red-500 font-medium px-1">{errors.amount}</p>
          )}
        </div>

        {/* 3. Loan Term Dropdown */}
        <div className="space-y-1.5">
          <label htmlFor="loanTerm" className="block text-sm font-semibold text-slate-800">
            Loan Term
          </label>
          <div className="relative">
            <select
              id="loanTerm"
              value={formData.loanTermMonths}
              onChange={(e) => updateFormData({ loanTermMonths: Number(e.target.value) })}
              className="w-full bg-slate-100/80 border border-slate-200 text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white appearance-none cursor-pointer pr-10 font-medium"
            >
              {loanTermOptions.map((term) => (
                <option key={term.value} value={term.value}>
                  {term.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 4. Purpose of Loan */}
        <div className="space-y-1.5">
          <label htmlFor="purpose" className="block text-sm font-semibold text-slate-800">
            Purpose of Loan
          </label>
          <input
            id="purpose"
            type="text"
            value={formData.purpose}
            onChange={(e) => {
              updateFormData({ purpose: e.target.value });
              if (errors.purpose) setErrors((prev) => ({ ...prev, purpose: undefined }));
            }}
            placeholder="e.g. Business expansion, tuition, or inventory"
            className={`w-full bg-slate-50 border ${
              errors.purpose ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'
            } text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:bg-white font-medium placeholder:text-slate-400 placeholder:font-normal`}
          />
          {errors.purpose && (
            <p className="text-xs text-red-500 font-medium px-1">{errors.purpose}</p>
          )}
        </div>

        {/* CTA Button */}
        <div className="pt-3">
          <button
            type="submit"
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-base rounded-full shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer uppercase tracking-wider text-center"
          >
            NEXT STEP
          </button>
        </div>
      </form>
    </div>
  );
};
