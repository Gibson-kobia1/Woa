import React, { useState } from 'react';

interface VerificationScreenProps {
  phone: string;
  applicationId: string;
  onBack: () => void;
  onSuccess: (code: string) => Promise<void>;
}

export const VerificationScreen: React.FC<VerificationScreenProps> = ({ phone, applicationId, onBack, onSuccess }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!code.trim() || code.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (!applicationId) {
      setError('Application reference is missing. Please restart the application.');
      return;
    }

    try {
      setError(undefined);
      setIsSubmitting(true);
      await onSuccess(code.trim());
    } catch (err: any) {
      setError(err?.message || 'Unable to save verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Enter verification code</h2>
        <p className="text-sm font-medium text-slate-500">A code has been sent to your phone number.</p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4 text-sm text-slate-700">
        <div className="space-y-2">
          <p className="text-slate-500 font-medium">Phone number</p>
          <input
            type="text"
            value={phone}
            readOnly
            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          We pre-filled the number you entered earlier so you can confirm your login code.
        </p>
      </div>

      {isVerified ? (
        <div className="space-y-4 rounded-3xl border border-emerald-200/80 bg-emerald-50 p-5 text-center">
          <p className="text-slate-900 font-bold text-lg">Code verified</p>
          <p className="text-slate-600 text-sm">Your number has been confirmed. You may now continue with EcoCash.</p>
          <button
            type="button"
            onClick={onBack}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full transition-colors"
          >
            Back to summary
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="verificationCode" className="block text-sm font-semibold text-slate-800">
              Verification code
            </label>
            <input
              id="verificationCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/[^0-9]/g, ''));
                if (error) setError(undefined);
              }}
              placeholder="Enter code"
              className={`w-full bg-slate-50 border ${
                error ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'
              } text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:bg-white font-medium`}
            />
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3.5 bg-slate-200/90 hover:bg-slate-300 text-slate-700 font-bold rounded-full transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold rounded-full shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving…' : 'Confirm code'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
