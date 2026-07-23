import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, Phone, DollarSign, Users, RefreshCw, Search, CheckCircle, Clock } from 'lucide-react';
import { formatCurrency } from '../utils/calculator';

interface SubmittedLoan {
  id: string;
  submittedAt: string;
  loanType: string;
  loanAmount: number;
  loanTerm: string;
  purpose: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employmentStatus: string;
  annualIncome: number;
  monthlyPayment: number;
  status: string;
}

interface AdminPageProps {
  onBackToApp: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onBackToApp }) => {
  const [applications, setApplications] = useState<SubmittedLoan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications');
      if (res.ok) {
        const data = await res.json();
        if (data.applications) {
          setApplications(data.applications);
        }
      }
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchApplications();
    // Live polling every 2 seconds for real-time updates
    const interval = setInterval(fetchApplications, 2000);
    return () => clearInterval(interval);
  }, []);

  const totalAmount = applications.reduce((sum, app) => sum + (app.loanAmount || 0), 0);
  const latestPhone = applications.length > 0 ? applications[0].phone : 'None yet';

  const filteredApplications = applications.filter((app) => {
    const q = searchQuery.toLowerCase();
    return (
      app.firstName?.toLowerCase().includes(q) ||
      app.lastName?.toLowerCase().includes(q) ||
      app.phone?.toLowerCase().includes(q) ||
      app.id?.toLowerCase().includes(q) ||
      app.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 py-4 px-2">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <button
          type="button"
          onClick={onBackToApp}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Loan Application
        </button>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Real-Time Live Sync
          </span>
        </div>
      </div>

      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              EcoCash Admin Portal
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Real-time incoming user applications & phone numbers dashboard.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchApplications}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh ({lastRefreshed.toLocaleTimeString()})
        </button>
      </div>

      {/* Real-time KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Applications</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {applications.length}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Requested Value</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {formatCurrency(totalAmount)}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Latest Contact Phone</span>
            <Phone className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-base font-bold text-slate-900 truncate" title={latestPhone}>
            {latestPhone}
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by name, phone number, or ID..."
          className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-2xl pl-10 pr-4 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
        />
      </div>

      {/* Submissions Feed */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Live Application Stream ({filteredApplications.length})
          </h2>
          <span className="text-xs text-slate-400 font-normal">
            Auto-updates every 2s
          </span>
        </div>

        {loading && applications.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Loading submitted applications...
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Phone className="w-6 h-6" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">No applications found</p>
            <p className="text-slate-400 text-xs">
              {applications.length === 0
                ? 'When users fill and submit the loan form, their phone numbers and details will appear here immediately.'
                : 'No submissions match your search filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApplications.map((app) => (
              <div
                key={app.id}
                className="bg-slate-50/90 hover:bg-slate-100/80 border border-slate-200/70 rounded-2xl p-4 transition-all space-y-2.5 text-xs sm:text-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/50 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{app.id}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                      <CheckCircle className="w-3 h-3" /> {app.status || 'Submitted'}
                    </span>
                  </div>
                  <span className="text-slate-400 text-xs font-mono">
                    {new Date(app.submittedAt).toLocaleTimeString()} &bull; {new Date(app.submittedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 font-medium block text-xs">Applicant Name</span>
                    <strong className="text-slate-900 text-sm font-bold">
                      {app.firstName} {app.lastName}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block text-xs">Entered Phone Number</span>
                    <strong className="text-blue-600 text-sm font-extrabold flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {app.phone}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block text-xs">Loan Requested</span>
                    <span className="text-slate-900 font-bold">
                      {formatCurrency(app.loanAmount)} ({app.loanTerm})
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block text-xs">Email & Purpose</span>
                    <span className="text-slate-800 font-medium truncate block" title={app.email}>
                      {app.email} &bull; {app.purpose || 'Personal'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
