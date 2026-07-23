import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error);
  const errorDiv = document.getElementById('error-display');
  if (errorDiv) {
    errorDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; background: #fee; color: #c00; padding: 20px; font-family: monospace; font-size: 12px; z-index: 9999;">
        <strong>Global Error:</strong> ${event.error?.message || String(event.error)}
      </div>
    `;
  }
});

// Global unhandled rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason);
  const errorDiv = document.getElementById('error-display');
  if (errorDiv) {
    errorDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; background: #fee; color: #c00; padding: 20px; font-family: monospace; font-size: 12px; z-index: 9999;">
        <strong>Unhandled Rejection:</strong> ${event.reason?.message || String(event.reason)}
      </div>
    `;
  }
});

console.log('[Main] App initialization started');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

console.log('[Main] App rendered successfully');
