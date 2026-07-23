import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

interface LoanApplication {
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

const applications: LoanApplication[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoints
  app.post('/api/applications', (req, res) => {
    try {
      const data = req.body;
      const newApp: LoanApplication = {
        id: `ECO-${Math.floor(100000 + Math.random() * 900000)}`,
        submittedAt: new Date().toISOString(),
        loanType: data.loanType || 'Personal Loan',
        loanAmount: Number(data.loanAmount) || 0,
        loanTerm: data.loanTerm || '12 Months',
        purpose: data.purpose || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        employmentStatus: data.employmentStatus || 'Employed',
        annualIncome: Number(data.annualIncome) || 0,
        monthlyPayment: Number(data.monthlyPayment) || 0,
        status: 'Pre-Approved',
      };

      applications.unshift(newApp);

      res.status(201).json({
        success: true,
        message: 'Loan application submitted successfully.',
        application: newApp,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/applications', (_req, res) => {
    res.json({ success: true, applications });
  });

  // Vite or Static files middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EcoCash Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
