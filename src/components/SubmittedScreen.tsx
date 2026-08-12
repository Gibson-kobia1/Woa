import React from 'react';

export const SubmittedScreen: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-white flex flex-col overflow-y-auto">
      <div className="max-w-md mx-auto px-6 py-8">
        <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg">
            <span className="text-4xl font-black">✓</span>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900">Application submitted</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Your application is submitted. Check back in a few minutes for an update.
          </p>
        </div>
      </div>
    </div>
  );
};
