import React, { useState } from 'react';
import { LoanFormData } from '../types';

interface Step2Props {
  formData: LoanFormData;
  updateFormData: (fields: Partial<LoanFormData>) => void;
  onNext: () => void;
  onPrevious: () => void;
  onPhoneReady?: () => Promise<void> | void;
}

export const Step2ApplicantDetails: React.FC<Step2Props> = ({
  formData,
  updateFormData,
  onNext,
  onPrevious,
  onPhoneReady,
}) => {
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }>({});

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    } = {};

    if (!formData.firstName || formData.firstName.trim().length < 1) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName || formData.lastName.trim().length < 1) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email || !validateEmail(formData.email)) {
      newErrors.email = 'Valid email address is required';
    }

    if (!formData.phone || formData.phone.trim().length < 7) {
      newErrors.phone = 'Valid phone number is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (onPhoneReady) {
      await onPhoneReady();
    }
    onNext();
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Loan Application
        </h2>
        <p className="text-sm font-medium text-slate-500">Step 2 of 3</p>
      </div>

      <form onSubmit={handleNext} className="space-y-5 pt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="firstName" className="block text-sm font-semibold text-slate-800">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => {
                updateFormData({ firstName: e.target.value });
                if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }));
              }}
              placeholder="e.g. Chanda"
              className={`w-full bg-slate-50 border ${
                errors.firstName ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'
              } text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:bg-white font-medium placeholder:text-slate-400 placeholder:font-normal`}
            />
            {errors.firstName && <p className="text-xs text-red-500 font-medium">{errors.firstName}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lastName" className="block text-sm font-semibold text-slate-800">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => {
                updateFormData({ lastName: e.target.value });
                if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }));
              }}
              placeholder="e.g. Mutale"
              className={`w-full bg-slate-50 border ${
                errors.lastName ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'
              } text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:bg-white font-medium placeholder:text-slate-400 placeholder:font-normal`}
            />
            {errors.lastName && <p className="text-xs text-red-500 font-medium">{errors.lastName}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-semibold text-slate-800">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => {
              updateFormData({ email: e.target.value });
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="e.g. chanda.mutale@example.com"
            className={`w-full bg-slate-50 border ${
              errors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'
            } text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:bg-white font-medium placeholder:text-slate-400 placeholder:font-normal`}
          />
          {errors.email && <p className="text-xs text-red-500 font-medium px-1">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phone" className="block text-sm font-semibold text-slate-800">
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => {
              updateFormData({ phone: e.target.value });
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            placeholder="e.g. +260 971234567"
            className={`w-full bg-slate-50 border ${
              errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'
            } text-slate-900 text-base rounded-2xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:bg-white font-medium placeholder:text-slate-400 placeholder:font-normal`}
          />
          <p className="text-xs text-slate-400 font-normal px-1">Enter 9 digits (e.g. 971234567)</p>
          {errors.phone && <p className="text-xs text-red-500 font-medium px-1">{errors.phone}</p>}
        </div>

        <div className="flex items-center gap-3 pt-3">
          <button
            type="button"
            onClick={onPrevious}
            className="w-1/2 py-3.5 px-4 bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 font-bold text-sm rounded-full transition-colors cursor-pointer uppercase tracking-wider text-center"
          >
            PREVIOUS
          </button>
          <button
            type="submit"
            className="w-1/2 py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-sm rounded-full shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer uppercase tracking-wider text-center"
          >
            NEXT STEP
          </button>
        </div>
      </form>
    </div>
  );
};
