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
    <div className="min-h-screen w-full bg-[#F3F4F6] flex flex-col items-center overflow-y-auto px-0 py-6">
      <div className="w-full max-w-md mx-4 rounded-[28px] bg-white px-6 py-10 shadow-sm">
        <div className="border-b border-gray-100 pb-4 mb-6">
          <div className="grid grid-cols-3 items-center">
            <button
              type="button"
              onClick={onBack}
              className="text-gray-600 text-xl font-semibold text-left"
            >
              ←
            </button>
            <h2 className="text-center text-xl font-bold text-[#111827]">OTP Verification</h2>
            <div className="w-6" />
          </div>
        </div>

        <div className="text-center px-2">
          <p className="text-sm text-[#6B7280]">Enter the OTP sent to your phone number</p>
          <p className="mt-3 text-lg font-semibold text-[#111827]">{maskedPhone}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          <div className="text-center">
            <p className="text-sm text-[#6B7280]">OTP</p>
          </div>

          <div className="mt-6 relative flex flex-row justify-center gap-2 md:gap-3">
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
                className={`h-12 w-12 rounded-xl border bg-white text-center text-2xl font-bold text-[#111827] flex items-center justify-center ${
                  index === 0 ? 'border-black' : 'border-[#2B7FFF]'
                }`}
              >
                {otp[index] ?? ''}
              </div>
            ))}
          </div>

          <div className="mt-6 text-center mb-8 text-sm text-[#6B7280]">
            <span>Resend OTP in </span>
            <span className="font-semibold text-[#0052CC]">92</span>
            <span> seconds</span>
          </div>

          {error && <p className="text-center text-xs text-red-500 font-medium mb-4">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#0052CC] px-4 py-4 text-base font-bold text-white transition-colors hover:bg-[#0048b3] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving…' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
};
