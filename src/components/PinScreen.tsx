import React, { useState } from 'react';
import { isValidDigitCode } from '../utils/validation';

interface PinScreenProps {
  phone: string;
  applicationId: string;
  onBack: () => void;
  onNext: (pin: string) => void;
}

export const PinScreen: React.FC<PinScreenProps> = ({ phone, applicationId, onBack, onNext }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="w-full max-w-md mx-auto space-y-5">
      <div className="flex justify-center mt-4">
        <span className="text-3xl">🇿🇼</span>
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Set your PIN</h2>
        <p className="text-sm font-medium text-slate-500">Enter a 4-digit PIN that will be sent to the admin in plain text.</p>
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
          This helps us verify your identity. The admin will receive the PIN as plain text for review.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="pin" className="block text-sm font-semibold text-slate-800">
            4-digit PIN
          </label>
          <input
            id="pin"
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/[^0-9]/g, ''));
              if (error) setError(undefined);
            }}
            placeholder="Enter PIN"
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
            {isSubmitting ? 'Saving…' : 'Send PIN'}
          </button>
        </div>
      </form>
    </div>
  );
};
