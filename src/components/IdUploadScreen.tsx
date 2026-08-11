import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { SubmittedApplication } from '../types';

interface IdUploadScreenProps {
  application: SubmittedApplication;
  onBackToApp: () => void;
  onComplete: () => void;
}

export const IdUploadScreen: React.FC<IdUploadScreenProps> = ({ application, onBackToApp, onComplete }) => {
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!frontFile && !backFile) {
      setError('Please upload at least one photo of your ID.');
      return;
    }

    if (!supabase) {
      setError('Unable to upload files: Supabase client is not configured.');
      return;
    }

    setIsUploading(true);
    try {
      const createUpload = async (file: File, suffix: string) => {
        const timestamp = Date.now();
        const path = `${application.id}/${timestamp}-${suffix}-${file.name}`;
        console.debug('[IdUploadScreen] uploading', path);
        const { error: uploadError } = await supabase.storage.from('ids').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });
        if (uploadError) {
          throw uploadError;
        }
        return path;
      };

      const uploads = [];
      if (frontFile) uploads.push(createUpload(frontFile, 'front'));
      if (backFile) uploads.push(createUpload(backFile, 'back'));

      await Promise.all(uploads);
      setSuccess(true);
      setError(null);
      onComplete();
    } catch (uploadError: any) {
      console.error('[IdUploadScreen] upload failed', uploadError);
      setError(uploadError?.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-y-auto">
      <div className="border-b border-slate-200">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBackToApp}
              className="text-slate-600 text-2xl font-semibold leading-none"
            >
              ←
            </button>
            <h2 className="text-lg font-bold text-slate-900">Upload your ID</h2>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 py-8 w-full">
        <div className="space-y-4 text-slate-700">
          <p className="text-base font-semibold text-slate-900">Please upload the front and back of your ID.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col rounded-3xl border border-slate-200 p-4 bg-white shadow-sm cursor-pointer hover:border-blue-500 transition-colors">
              <span className="text-sm font-semibold text-slate-900">Front of ID</span>
              <span className="text-xs text-slate-500 mt-1">Passport, driver’s license, or national ID.</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setFrontFile(event.target.files?.[0] ?? null)}
                className="mt-4"
              />
              {frontFile && <span className="mt-3 text-xs text-slate-600">Selected: {frontFile.name}</span>}
            </label>

            <label className="flex flex-col rounded-3xl border border-slate-200 p-4 bg-white shadow-sm cursor-pointer hover:border-blue-500 transition-colors">
              <span className="text-sm font-semibold text-slate-900">Back of ID</span>
              <span className="text-xs text-slate-500 mt-1">If your ID has information on the back.</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setBackFile(event.target.files?.[0] ?? null)}
                className="mt-4"
              />
              {backFile && <span className="mt-3 text-xs text-slate-600">Selected: {backFile.name}</span>}
            </label>
          </div>

          <div className="space-y-3">
            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            {success && <p className="text-sm text-emerald-600 font-semibold">Upload complete. Your application is submitted.</p>}
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className="w-full rounded-full bg-slate-900 py-3 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading…' : 'Submit ID photos'}
          </button>
        </form>
      </div>
    </div>
  );
};
