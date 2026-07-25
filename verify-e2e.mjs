import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
const runtimeErrors = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    errors.push(msg.text());
  }
});

page.on('pageerror', (error) => {
  runtimeErrors.push(error.message);
});

page.on('requestfailed', (request) => {
  if (!request.failure()?.errorText?.includes('ERR_ABORTED') && !request.url().includes('/favicon.ico')) {
    errors.push(`requestfailed: ${request.url()} :: ${request.failure()?.errorText}`);
  }
});

try {
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  const bodyText = await page.locator('body').innerText();
  console.log('APP_LOAD_OK', bodyText.includes('Admin Portal') || bodyText.includes('EcoCash'));

  await page.goto('http://127.0.0.1:3000/admin', { waitUntil: 'networkidle' });
  const usernameInput = page.locator('input').first();
  const passwordInput = page.locator('input').nth(1);
  await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  await usernameInput.fill('venomous');
  await passwordInput.fill('venomous99');
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector('text=Admin dashboard', { timeout: 15000 });
  console.log('ADMIN_LOGIN_OK');

  const appsCounter = page.locator('text=/\\d+ total/').first();
  const counterText = await appsCounter.textContent();
  const initialApplicationCount = Number((counterText || '').match(/(\d+)/)?.[1] || '0');
  console.log('APPS_COUNTER', counterText);

  const payload = {
    loanType: 'Personal Loan',
    loanAmount: 6500,
    loanTerm: '18 Months',
    purpose: 'Playwright verification',
    firstName: 'Playwright',
    lastName: 'Test',
    email: 'playwright@example.com',
    phone: '+15551234567',
    employmentStatus: 'Employed',
    annualIncome: 80000,
    monthlyPayment: 420,
    verificationCode: 'PW1234',
  };

  const response = await fetch('http://127.0.0.1:3000/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'insert failed');
  console.log('APPLICATION_INSERT_OK', body.application?.id);

  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Playwright', { timeout: 20000 });
  const updatedCounterText = await page.locator('text=/\\d+ total/').first().textContent();
  const updatedApplicationCount = Number((updatedCounterText || '').match(/(\d+)/)?.[1] || '0');
  console.log('APP_COUNT_AFTER_INSERT', { initialApplicationCount, updatedApplicationCount });

  await page.locator('button:has-text("Create viewer link")').click();
  await page.waitForSelector('a[href*="/viewer?token="]', { timeout: 20000 });
  const createdLink = await page.locator('a[href*="/viewer?token="]').first().getAttribute('href');
  console.log('VIEWER_LINK_CREATED', createdLink || 'NONE');

  const viewerPage = await browser.newPage();
  await viewerPage.goto(createdLink || 'http://127.0.0.1:3000/viewer?token=test', { waitUntil: 'networkidle' });
  await viewerPage.waitForSelector('text=Shared admin viewer', { timeout: 20000 });
  await viewerPage.waitForSelector('text=Playwright', { timeout: 20000 });
  console.log('VIEWER_OPEN_OK');

  await page.locator('button:has-text("Revoke")').first().click();
  await page.waitForTimeout(1000);
  await viewerPage.reload({ waitUntil: 'networkidle' });
  const viewerBodyText = await viewerPage.locator('body').innerText();
  const viewerRevoked = viewerBodyText.includes('Invalid or expired viewer link.') || viewerBodyText.includes('Missing viewer token.');
  console.log('VIEWER_AFTER_REVOKE', viewerRevoked);
} catch (error) {
  console.error('E2E_FAIL', error.message);
  runtimeErrors.push(error.message);
} finally {
  await browser.close();
}

console.log('CONSOLE_ERRORS', errors);
console.log('RUNTIME_ERRORS', runtimeErrors);
