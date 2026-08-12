import React, { useEffect, useMemo, useState } from 'react';
import { fetchApplicationByIdFromSupabase } from '../utils/supabaseDirect';

const CONFIRMATION_START_KEY = 'confirmationStart';
const CONFIRMATION_DELAY_MS = 30000;

interface ConfirmationScreenProps {
  applicationId: string;
  onComplete?: () => void;
  onRetry?: () => void;
}

export const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({ applicationId, onComplete, onRetry }) => {
  const [timerComplete, setTimerComplete] = useState(false);
  const [status, setStatus] = useState<string>('Pre-Approved');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const checkStatus = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const application = await fetchApplicationByIdFromSupabase(applicationId);
      if (!application) {
        setError('Unable to verify application status.');
        return;
      }
      setStatus(application.status ?? 'Pre-Approved');
      if (application.status === 'Approved') {
        window.localStorage.removeItem(CONFIRMATION_START_KEY);
        onComplete?.();
      }
      if (application.status === 'RetryRequested') {
        window.localStorage.removeItem(CONFIRMATION_START_KEY);
        onRetry?.();
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to check approval status.');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (!timerComplete) {
      return;
    }

    void checkStatus();
    const intervalId = window.setInterval(() => {
      void checkStatus();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [timerComplete, applicationId]);

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
        <div className="flex flex-col items-center gap-2 pt-2">
          {timerComplete ? (
            <p className="text-xs text-slate-500">Current status: {status}</p>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="text-center text-xs text-slate-400 mt-6">
        &copy; 2025 EcoCash
      </div>
    </div>
  );
};
