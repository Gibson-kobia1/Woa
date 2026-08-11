import React, { useEffect, useState } from 'react';
import { fetchApplicationByIdFromSupabase } from '../utils/supabaseDirect';

interface ApprovalPendingScreenProps {
  applicationId: string;
  onApproved: () => void;
}

export const ApprovalPendingScreen: React.FC<ApprovalPendingScreenProps> = ({ applicationId, onApproved }) => {
  const [status, setStatus] = useState<string>('Pre-Approved');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkApproval = async () => {
    if (!applicationId) {
      setError('Missing application ID.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const application = await fetchApplicationByIdFromSupabase(applicationId);
      if (!application) {
        setError('Unable to verify application status.');
        return;
      }

      setStatus(application.status ?? 'Pre-Approved');
    } catch (err: any) {
      setError(err?.message || 'Error checking approval status.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkApproval();
    const intervalId = window.setInterval(checkApproval, 5000);
    return () => window.clearInterval(intervalId);
  }, [applicationId]);

  useEffect(() => {
    if (status === 'Approved') {
      onApproved();
    }
  }, [status, onApproved]);

  return (
    <div className="min-h-screen w-full bg-white flex flex-col overflow-y-auto">
      <div className="max-w-md mx-auto px-6 py-8">
        <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg">
            <span className="text-4xl font-black">⌛</span>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900">Waiting for approval</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Your application is now waiting for the admin to approve the ID upload step.
          </p>
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 text-left text-sm text-slate-700">
            <p className="font-semibold text-slate-900">What happens next</p>
            <ul className="mt-3 space-y-2 list-disc pl-5 text-slate-600">
              <li>The admin must approve this application before you can upload ID.</li>
              <li>We will check again automatically in a few seconds.</li>
            </ul>
          </div>
          <div className="mt-6 text-sm text-slate-500">
            {isLoading ? 'Checking approval status…' : `Current status: ${status}`}
          </div>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={checkApproval}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
            disabled={isLoading}
          >
            Refresh status
          </button>
        </div>
      </div>
    </div>
  );
};
