import React from 'react';
import { ArrowLeft, Menu } from 'lucide-react';
import { AppStep } from '../types';

interface HeaderProps {
  currentStep: AppStep;
  onBack: () => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentStep, onBack, onReset }) => {
  const isCalculator = currentStep === 'calculator';
  const isSuccess = currentStep === 'success';

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-xs px-4 py-3 sm:px-6">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="w-9 h-9 flex items-center justify-start">
          {!isCalculator && !isSuccess ? (
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onReset}
              className="p-2 -ml-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5 stroke-[2]" />
            </button>
          )}
        </div>

        {/* EcoCash Logo: Eco in Blue, Cash in Red */}
        <button
          onClick={onReset}
          className="text-2xl font-extrabold tracking-tight focus:outline-hidden flex items-center justify-center cursor-pointer"
        >
          <span className="text-blue-600">Eco</span>
          <span className="text-red-600">Cash</span>
        </button>

        <div className="w-9 h-9 flex items-center justify-end">
          {/* Subtle placeholder to keep logo perfectly centered */}
        </div>
      </div>
    </header>
  );
};
