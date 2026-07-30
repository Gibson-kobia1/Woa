import React, { useState } from 'react';
import { Check, RefreshCw, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { SubmittedApplication } from '../types';
import { formatCurrency, formatExactCurrency } from '../utils/calculator';

interface SuccessScreenProps {
  application: SubmittedApplication;
  onNewApplication: () => void;
  onContinue: () => void;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  application,
  onNewApplication,
  onContinue,
}) => {
  const [showSummary, setShowSummary] = useState(false);

  return (
    <div className="w-full max-w-md mx-auto space-y-6 py-2 px-1 text-center">
      {/* Big Green Circular Badge */}
      <div className="w-20 h-20 bg-[#00C853] text-white rounded-full flex items-center justify-center mx-auto shadow-md">
        <Check className="w-12 h-12 stroke-[3.5]" />
      </div>

      {/* Main Headline in Green */}
      <div className="space-y-3">
        <h2 className="text-2xl sm:text-3xl font-black text-[#00C853] tracking-tight leading-tight">
          Loan Application<br />Submitted
        </h2>

        <div className="text-slate-600 text-sm font-medium leading-relaxed max-w-xs mx-auto space-y-3 pt-1">
          <p>
            Your loan application has been submitted. Please wait for approval.
          </p>
          <p>
            You can continue with a new application whenever you are ready.
          </p>
        </div>
      </div>

      {/* Primary CTA Button */}
      <div className="pt-1 space-y-3">
        <button
          type="button"
          onClick={onContinue}
          className="w-full py-4 px-6 bg-[#0066FF] hover:bg-blue-700 text-white font-bold text-base rounded-full shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer text-center"
        >
          Start New Application
        </button>

        {/* Collapsible Application Summary Toggle */}
        <button
          type="button"
          onClick={() => setShowSummary(!showSummary)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors pt-1 cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          {showSummary ? 'Hide Application Details' : 'View Application Summary'}
          {showSummary ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable Application Summary */}
      {showSummary && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs text-left animate-fadeIn">
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Reference ID</span>
            <span className="font-mono font-bold text-slate-800">{application.id}</span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Applicant</span>
            <span className="text-slate-900 font-bold">
              {application.firstName} {application.lastName}
            </span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Loan Amount</span>
            <span className="text-blue-600 font-bold">{formatCurrency(application.loanAmount)}</span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Term</span>
            <span className="text-slate-900 font-bold">{application.loanTermMonths} Months</span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Est. Monthly Payment</span>
            <span className="text-blue-600 font-extrabold">{formatExactCurrency(application.monthlyPayment)}</span>
          </div>

          <div className="flex justify-between items-center pt-1">
            <button
              type="button"
              onClick={onNewApplication}
              className="w-full py-2 bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 font-bold rounded-lg text-xs text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Start New Application
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
