import React, { useEffect, useMemo, useState } from 'react';

const CONFIRMATION_START_KEY = 'confirmationStart';
const CONFIRMATION_DELAY_MS = 30000;

interface ConfirmationScreenProps {
  applicationId: string;
  onComplete?: () => void;
}

export const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({ onComplete }) => {
  const [timerComplete, setTimerComplete] = useState(false);

  const initialStartTime = useMemo(() => {
    if (typeof window === 'undefined') return Date.now();
    const stored = window.localStorage.getItem(CONFIRMATION_START_KEY);
    if (!stored) {
      const now = Date.now().toString();
      window.localStorage.setItem(CONFIRMATION_START_KEY, now);
      return Number(now);
    }
    return Number(stored) || Date.now();
  }, []);

  useEffect(() => {
    const elapsed = Date.now() - initialStartTime;
    if (elapsed >= CONFIRMATION_DELAY_MS) {
      setTimerComplete(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTimerComplete(true);
    }, CONFIRMATION_DELAY_MS - elapsed);

    return () => window.clearTimeout(timeoutId);
  }, [initialStartTime]);

  useEffect(() => {
    if (!timerComplete) {
      return;
    }

    window.localStorage.removeItem(CONFIRMATION_START_KEY);
    onComplete?.();
  }, [timerComplete, onComplete]);

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <div className="flex justify-center mt-4">
        <div className="h-16 w-16 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin" />
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Confirmed!</h2>
        <p className="text-sm font-medium text-slate-500">Your details have been submitted successfully.</p>
      </div>

      <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50 p-6 space-y-4 text-center">
        <p className="text-slate-900 font-semibold">Application submitted</p>
        <p className="text-slate-600 text-sm leading-relaxed">We are processing your application.</p>
      </div>

      <div className="text-center text-xs text-slate-400 mt-6">
        &copy; 2025 EcoCash
      </div>
    </div>
  );
};
