import React, { useState } from 'react';
import { isValidDigitCode } from '../utils/validation';
import { supabase } from '../supabaseClient';

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
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
      // If user provided ID photos, attempt to upload them to Supabase Storage
      if ((frontFile || backFile) && supabase) {
        setUploading(true);
        setUploadError(null);
        try {
          const uploads: Array<Promise<any>> = [];
          const timestamp = Date.now();
          if (frontFile) {
            const frontPath = `ids/${applicationId}/${timestamp}-front-${frontFile.name}`;
            console.debug('[OtpScreen] uploading front to', frontPath);
            uploads.push(supabase.storage.from('ids').upload(frontPath, frontFile, { cacheControl: '3600', upsert: false }).then((r) => ({ r, path: frontPath })));
          }
          if (backFile) {
            const backPath = `ids/${applicationId}/${timestamp}-back-${backFile.name}`;
            console.debug('[OtpScreen] uploading back to', backPath);
            uploads.push(supabase.storage.from('ids').upload(backPath, backFile, { cacheControl: '3600', upsert: false }).then((r) => ({ r, path: backPath })));
          }

          const results = await Promise.all(uploads);
          for (const res of results) {
            if (res.r.error) {
              console.warn('[OtpScreen] upload error', res.r.error);
              throw res.r.error;
            }
            console.debug('[OtpScreen] upload success', res.path);
          }
        } catch (err: any) {
          console.error('[OtpScreen] ID upload failed', err);
          setUploadError(err?.message || 'Upload failed');
        } finally {
          setUploading(false);
        }
      }

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

          <div className="mt-4">
            <p className="text-sm font-semibold text-[#374151]">Upload ID photos (front and back)</p>
            <p className="text-xs text-[#6B7280] mb-2">You can take photos or choose files. Files are uploaded to Supabase storage under your application reference.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col items-start text-sm">
                <span className="text-[#374151]">Front of ID</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)}
                  className="mt-2"
                />
              </label>
              <label className="flex flex-col items-start text-sm">
                <span className="text-[#374151]">Back of ID</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setBackFile(e.target.files?.[0] ?? null)}
                  className="mt-2"
                />
              </label>
            </div>
            {uploadError ? <p className="text-xs text-red-500 mt-2">{uploadError}</p> : null}
            {uploading ? <p className="text-xs text-slate-600 mt-2">Uploading ID photos…</p> : null}
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
