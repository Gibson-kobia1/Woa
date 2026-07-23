import express from 'express';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
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

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const applications: LoanApplication[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // API Endpoints
  app.post('/api/applications', async (req, res) => {
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

      if (supabase) {
        const { data: insertedData, error } = (await supabase
          .from('applications')
          .insert([newApp])) as any;

        if (error) {
          throw error;
        }

        const insertedApp = insertedData && Array.isArray(insertedData) && insertedData.length > 0 ? insertedData[0] : newApp;
        res.status(201).json({
          success: true,
          message: 'Loan application submitted successfully.',
          application: insertedApp,
        });
        return;
      }

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

  app.get('/api/applications', async (req, res) => {
    try {
      console.log('[API] Fetching applications with query:', req.query);
      const limit = Number(req.query.limit) || 20;
      const rowLimit = Math.min(Math.max(limit, 1), 100);
      console.log('[API] Row limit:', rowLimit);

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('applications')
            .select('*')
            .order('submittedAt', { ascending: false })
            .limit(rowLimit);

          if (error) {
            throw error;
          }

          res.json({ success: true, applications: data ?? [] });
          return;
        } catch (supabaseError: any) {
          console.error('Supabase fetch failed:', supabaseError?.message || supabaseError);
        }
      }

      res.json({ success: true, applications: applications.slice(0, rowLimit) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite or Static files middleware
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Server] Setting up Vite middleware for dev mode');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');

    // Vite middleware handles static files and transforms HTML
    app.use(vite.middlewares);

    // Final SPA fallback - serve index.html for any unhandled routes
    app.use('*', async (req, res) => {
      console.log(`[Server] SPA fallback for: ${req.path}`);
      try {
        const html = await vite.transformIndexHtml(req.path, indexHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
      } catch (e) {
        console.error(`[Server] Error in SPA fallback: ${e}`);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(indexHtml);
      }
    });
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
