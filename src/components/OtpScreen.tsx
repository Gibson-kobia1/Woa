import React, { useState } from 'react';
import { isValidDigitCode } from '../utils/validation';

interface OtpScreenProps {
  phone: string;
  applicationId: string;
  verificationDisplay: string;
  onBack: () => void;
  onSuccess: (otp: string) => void;
}

export const OtpScreen: React.FC<OtpScreenProps> = ({ phone, applicationId, verificationDisplay: _verificationDisplay, onBack, onSuccess }) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maskedPhone = phone.length >= 8
    ? `${phone.slice(0, 4)}${'*'.repeat(Math.max(0, phone.length - 7))}${phone.slice(-3)}`
    : phone;

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
    <div className="min-h-screen w-full bg-white flex flex-col overflow-y-auto">
      <div className="border-b border-gray-200">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="text-gray-600 text-2xl font-semibold leading-none"
            >
              ←
            </button>
            <h2 className="text-lg font-bold text-[#111827]">OTP Verification</h2>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 py-8 w-full">
        <div className="text-center space-y-3">
          <p className="text-sm text-[#6B7280]">Enter the OTP sent to your phone number</p>
          <p className="text-base font-semibold text-[#111827]">{maskedPhone}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <div className="text-center mb-4">
              <p className="text-sm text-[#6B7280]">OTP</p>
            </div>

            <div className="relative flex flex-row justify-center gap-2">
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
                className="absolute inset-0 opacity-0 text-transparent caret-transparent"
                aria-label="OTP input"
              />
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className={`h-12 w-12 rounded-lg border text-center text-2xl font-bold text-[#111827] flex items-center justify-center bg-white ${
                    index === 0 ? 'border-black' : 'border-[#2B7FFF]'
                  }`}
                >
                  {otp[index] ?? ''}
                </div>
              ))}
            </div>
          </div>

          <div className="text-center text-sm text-[#6B7280]">
            <span>Resend OTP in </span>
            <span className="font-semibold text-[#0052CC]">92</span>
            <span> seconds</span>
          </div>

          {error && <p className="text-center text-xs text-red-500 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#0052CC] py-3 text-base font-bold text-white transition-colors hover:bg-[#0048b3] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving…' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
};
