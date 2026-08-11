import React, { useEffect, useState } from 'react';
import { fetchApplicationByIdFromSupabase } from '../utils/supabaseDirect';

interface ConfirmationScreenProps {
  applicationId: string;
  onComplete?: () => void;
}

export const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({ applicationId, onComplete }) => {
  const [timerComplete, setTimerComplete] = useState(false);
  const [status, setStatus] = useState<string>('Pre-Approved');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setTimerComplete(true), 30000);
    return () => window.clearTimeout(timeoutId);
  }, []);

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
        onComplete?.();
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
        <span className="text-5xl">✓</span>
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Confirmed!</h2>
        <p className="text-sm font-medium text-slate-500">Your details have been submitted successfully.</p>
      </div>

      <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50 p-6 space-y-4 text-center">
        <p className="text-slate-900 font-semibold">Application submitted</p>
        <p className="text-slate-600 text-sm leading-relaxed">We are processing your application.</p>
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-slate-600 font-medium">
            {timerComplete ? 'The timer has ended. Waiting for admin approval to continue.' : 'Please wait 30 seconds while we prepare your application.'}
          </p>
          {timerComplete ? (
            <p className="text-xs text-slate-500">Current status: {status}</p>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {timerComplete ? (
          <button
            type="button"
            onClick={() => {
              void checkStatus();
            }}
            disabled={isChecking}
            className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isChecking ? 'Checking…' : 'Refresh approval status'}
          </button>
        ) : null}
      </div>

      <div className="text-center text-xs text-slate-400 mt-6">
        &copy; 2025 EcoCash
      </div>
    </div>
  );
};
