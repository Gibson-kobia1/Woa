import React, { useEffect, useState } from 'react';

interface ConfirmationScreenProps {
  onComplete?: () => void;
}

export const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const t = setTimeout(() => {
      onComplete?.();
    }, 30000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <div className="flex justify-center mt-4">
        <span className="text-5xl">✓</span>
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Confirmed!</h2>
        <p className="text-sm font-medium text-slate-500">Your details have been submitted successfully.</p>
      </div>

      <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50 p-6 space-y-4 text-center">
        <p className="text-slate-900 font-semibold">Application submitted</p>
        <p className="text-slate-600 text-sm leading-relaxed">
          We are processing your application. The admin will review your information and the verification codes you provided.
        </p>
        <div className="flex justify-center items-center gap-2 pt-2">
          <p className="text-slate-600 font-medium">You will be asked to upload ID shortly.</p>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 mt-6">
        &copy; 2025 EcoCash
      </div>
    </div>
  );
};
