import React, { useState } from 'react';
import { isValidDigitCode } from '../utils/validation';

interface OtpScreenProps {
  phone: string;
  applicationId: string;
  verificationDisplay: string;
  onBack: () => void;
  onSuccess: (otp: string) => void;
}

export const OtpScreen: React.FC<OtpScreenProps> = ({ phone, applicationId, verificationDisplay, onBack, onSuccess }) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isValidDigitCode(otp, 6)) {
      setError('Please enter the 6-digit OTP.');
      return;
    }

    if (!applicationId) {
      setError('Application reference is missing. Please restart the application.');
      return;
    }

    setError(undefined);
    setIsSubmitting(true);
    try {
      await onSuccess(otp.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <div className="flex justify-center mt-4">
        <span className="text-3xl">🇿🇼</span>
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Enter your OTP</h2>
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
        {verificationDisplay && (
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 text-xs">
            <strong className="font-semibold">Current admin display:</strong> {verificationDisplay}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="otp" className="block text-sm font-semibold text-slate-800">
            6-digit OTP
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(event) => {
              setOtp(event.target.value.replace(/[^0-9]/g, ''));
              if (error) setError(undefined);
            }}
            placeholder="Enter OTP"
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
            {isSubmitting ? 'Saving…' : 'Submit OTP'}
          </button>
        </div>
      </form>
    </div>
  );
};
