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
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 text-left text-sm text-slate-700">
            <p className="font-semibold text-slate-900">What happens next</p>
            <ul className="mt-3 space-y-3 list-disc pl-5 text-slate-600">
              <li>Your ID photos were uploaded and stored.</li>
              <li>Your application is being processed.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
