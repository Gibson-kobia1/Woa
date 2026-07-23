import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

interface AdminPageProps {
  onBackToApp: () => void;
}

interface ApplicationRecord {
  phone: string;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onBackToApp }) => {
  const [latestPhone, setLatestPhone] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLatestPhone = async () => {
    try {
      const res = await fetch('/api/applications?limit=1');
      if (!res.ok) {
        throw new Error('Failed to fetch applications');
      }
      const data = await res.json();
      const phone = data.applications?.[0]?.phone ?? '';
      setLatestPhone(phone);
    } catch (error) {
      console.error(error);
      setLatestPhone('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestPhone();
    const interval = setInterval(fetchLatestPhone, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100/90 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-[28px] shadow-sm p-10 relative">
        <button
          type="button"
          onClick={onBackToApp}
          className="absolute top-6 left-6 text-slate-500 hover:text-slate-900 transition-colors"
          aria-label="Back to Loan Application"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="min-h-[320px] flex items-center justify-center">
          <span className="text-[4rem] sm:text-[5rem] font-extrabold tracking-tight text-slate-900">
            {isLoading ? 'Loading...' : latestPhone || 'No phone entered yet'}
          </span>
        </div>
      </div>
    </div>
  );
};
