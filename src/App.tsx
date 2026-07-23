import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { LoanCalculatorScreen } from './components/LoanCalculatorScreen';
import { Step1LoanParameters } from './components/Step1LoanParameters';
import { Step2ApplicantDetails } from './components/Step2ApplicantDetails';
import { Step3FinancialReview } from './components/Step3FinancialReview';
import { SuccessScreen } from './components/SuccessScreen';
import { VerificationScreen } from './components/VerificationScreen';
import { AdminPage } from './components/AdminPage';
import { AppStep, LoanFormData, SubmittedApplication } from './types';
import { calculateMonthlyPayment } from './utils/calculator';

const initialFormData: LoanFormData = {
  loanType: 'Personal Loan',
  loanAmount: 5000,
  loanTermMonths: 12,
  purpose: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  employmentStatus: 'Employed',
  annualIncome: '',
};

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>('calculator');
  const [isAdminView, setIsAdminView] = useState<boolean>(() => {
    const isAdmin = window.location.pathname === '/admin';
    console.log('[App] Initializing, pathname:', window.location.pathname, 'isAdmin:', isAdmin);
    return isAdmin;
  });
  const [formData, setFormData] = useState<LoanFormData>(initialFormData);
  const [submittedApplication, setSubmittedApplication] = useState<SubmittedApplication | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    console.log('[App] useEffect - current isAdminView:', isAdminView);
    const handlePopState = () => {
      const newIsAdmin = window.location.pathname === '/admin';
      console.log('[App] popstate - pathname:', window.location.pathname, 'newIsAdmin:', newIsAdmin);
      setIsAdminView(newIsAdmin);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToAdmin = () => {
    console.log('[App] Navigating to /admin');
    window.history.pushState({}, '', '/admin');
    setIsAdminView(true);
  };

  const navigateToApp = () => {
    console.log('[App] Navigating back to /');
    window.history.pushState({}, '', '/');
    setIsAdminView(false);
  };

  const updateFormData = (fields: Partial<LoanFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleBack = () => {
    if (currentStep === 'step1') setCurrentStep('calculator');
    else if (currentStep === 'step2') setCurrentStep('step1');
    else if (currentStep === 'step3') setCurrentStep('step2');
    else if (currentStep === 'success') setCurrentStep('calculator');
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setSubmittedApplication(null);
    setCurrentStep('calculator');
  };

  const handleSubmitApplication = async () => {
    setIsSubmitting(true);
    const { monthlyPayment } = calculateMonthlyPayment(
      formData.loanAmount,
      formData.loanTermMonths
    );

    const payload = {
      ...formData,
      monthlyPayment,
    };

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        setSubmittedApplication(result.application);
      } else {
        // Fallback for standalone/mock client state
        const fallbackApp: SubmittedApplication = {
          ...formData,
          id: `ECO-${Math.floor(100000 + Math.random() * 900000)}`,
          submittedAt: new Date().toISOString(),
          monthlyPayment,
          status: 'Pre-Approved',
          annualIncome: Number(formData.annualIncome) || 0,
        };
        setSubmittedApplication(fallbackApp);
      }
    } catch {
      // Fallback in case of network issue
      const fallbackApp: SubmittedApplication = {
        ...formData,
        id: `ECO-${Math.floor(100000 + Math.random() * 900000)}`,
        submittedAt: new Date().toISOString(),
        monthlyPayment,
        status: 'Pre-Approved',
        annualIncome: Number(formData.annualIncome) || 0,
      };
      setSubmittedApplication(fallbackApp);
    } finally {
      setIsSubmitting(false);
      setCurrentStep('success');
    }
  };

  if (isAdminView) {
    return (
      <div className="min-h-screen bg-slate-100/90 text-slate-900 font-sans flex flex-col justify-between selection:bg-blue-500 selection:text-white">
        <Header
          currentStep={currentStep}
          onBack={navigateToApp}
          onReset={navigateToApp}
        />
        <main className="flex-1 flex items-center justify-center p-3 sm:p-6">
          <AdminPage onBackToApp={navigateToApp} />
        </main>
        <footer className="py-4 text-center text-xs text-slate-400 font-medium">
          &copy; 2025 EcoCash Admin
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 font-sans flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Sticky Top Header Navigation */}
      <Header
        currentStep={currentStep}
        onBack={handleBack}
        onReset={handleReset}
      />

      {/* Main Container Card */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl shadow-sm p-5 sm:p-7 transition-all my-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {currentStep === 'calculator' && (
                <LoanCalculatorScreen
                  loanAmount={formData.loanAmount}
                  setLoanAmount={(val) => updateFormData({ loanAmount: val })}
                  loanTermMonths={formData.loanTermMonths}
                  setLoanTermMonths={(val) => updateFormData({ loanTermMonths: val })}
                  onApplyNow={() => setCurrentStep('step1')}
                />
              )}

              {currentStep === 'step1' && (
                <Step1LoanParameters
                  formData={formData}
                  updateFormData={updateFormData}
                  onNext={() => setCurrentStep('step2')}
                />
              )}

              {currentStep === 'step2' && (
                <Step2ApplicantDetails
                  formData={formData}
                  updateFormData={updateFormData}
                  onNext={() => setCurrentStep('step3')}
                  onPrevious={() => setCurrentStep('step1')}
                />
              )}

              {currentStep === 'step3' && (
                <Step3FinancialReview
                  formData={formData}
                  updateFormData={updateFormData}
                  onSubmit={handleSubmitApplication}
                  onPrevious={() => setCurrentStep('step2')}
                  isSubmitting={isSubmitting}
                />
              )}

              {currentStep === 'success' && submittedApplication && (
                <SuccessScreen
                  application={submittedApplication}
                  onNewApplication={handleReset}
                  onContinue={() => setCurrentStep('verification')}
                />
              )}

              {currentStep === 'verification' && (
                <VerificationScreen
                  phone={formData.phone}
                  onBack={() => setCurrentStep('success')}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Sticky / Centered Footer with Admin Link */}
      <footer className="py-4 text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-3">
        <span>&copy; 2025 EcoCash</span>
        <span>&bull;</span>
        <button
          type="button"
          onClick={navigateToAdmin}
          className="hover:text-slate-600 transition-colors cursor-pointer underline"
        >
          Admin Portal
        </button>
      </footer>
    </div>
  );
}
