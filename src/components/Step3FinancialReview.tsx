import React, { useState } from 'react';
import { LoanFormData } from '../types';
import { formatCurrency } from '../utils/calculator';

interface Step3Props {
  formData: LoanFormData;
  updateFormData: (fields: Partial<LoanFormData>) => void;
  onSubmit: () => void;
  onPrevious: () => void;
  isSubmitting: boolean;
}

export const Step3FinancialReview: React.FC<Step3Props> = ({
  formData,
  updateFormData,
  onSubmit,
  onPrevious,
  isSubmitting,
}) => {
  const [errors, setErrors] = useState<{ annualIncome?: string }>({});

  const employmentOptions = [
    'Employed',
    'Self-Employed',
    'Unemployed',
    'Student',
    'Retired',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.annualIncome || Number(formData.annualIncome) <= 0) {
      setErrors({ annualIncome: 'Please enter a valid annual income' });
      return;
    }
    setErrors({});
    onSubmit();
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      {/* Step Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Final Review
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 mx-auto rounded-full" />
        <p className="text-sm font-medium text-slate-500 pt-1">Step 3 of 3</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Employment Status */}
        <div className="space-y-1.5">
          <label htmlFor="employmentStatus" className="block text-sm font-semibold text-slate-800 text-center">
            Employment Status
          </label>
          <div className="relative">
            <select
              id="employmentStatus"
              value={formData.employmentStatus}
              onChange={(e) => updateFormData({ employmentStatus: e.target.value })}
              className="w-full bg-slate-100/80 border border-slate-200 text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white appearance-none cursor-pointer pr-10 font-medium"
            >
              {employmentOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
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

        {/* Annual Income ($) */}
        <div className="space-y-1.5">
          <label htmlFor="annualIncome" className="block text-sm font-semibold text-slate-800 text-center">
            Annual Income ($)
          </label>
          <input
            id="annualIncome"
            type="number"
            min={1000}
            value={formData.annualIncome}
            onChange={(e) => {
              const val = e.target.value === '' ? '' : Number(e.target.value);
              updateFormData({ annualIncome: val });
              if (errors.annualIncome) setErrors({});
            }}
            placeholder="e.g. 50000"
            className={`w-full bg-slate-50 border ${
              errors.annualIncome ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'
            } text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:bg-white font-medium text-center placeholder:text-slate-400 placeholder:font-normal`}
          />
          {errors.annualIncome && (
            <p className="text-xs text-red-500 font-medium text-center">{errors.annualIncome}</p>
          )}
        </div>

        {/* Dynamic Data Consolidation Card */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2.5 text-sm">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Loan Type:</span>
            <span className="text-slate-900 font-bold">{formData.loanType}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Amount:</span>
            <span className="text-slate-900 font-bold">{formatCurrency(formData.loanAmount)}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Term:</span>
            <span className="text-slate-900 font-bold">{formData.loanTermMonths} Months</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Purpose:</span>
            <span className="text-slate-900 font-bold">{formData.purpose || 'N/A'}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Name:</span>
            <span className="text-slate-900 font-bold">
              {formData.firstName} {formData.lastName}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Email:</span>
            <span className="text-slate-900 font-bold truncate max-w-[200px]" title={formData.email}>
              {formData.email}
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Phone:</span>
            <span className="text-slate-900 font-bold">{formData.phone}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={isSubmitting}
            className="w-1/2 py-3.5 px-4 bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 font-bold text-sm rounded-full transition-colors cursor-pointer uppercase tracking-wider text-center disabled:opacity-50"
          >
            PREVIOUS
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-1/2 py-3.5 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-xs sm:text-sm rounded-full shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer uppercase tracking-wider text-center flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white mr-1" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                SUBMITTING...
              </>
            ) : (
              'SUBMIT APPLICATION'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
