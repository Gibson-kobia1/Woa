# EcoCash Loan Application Dashboard

This repo contains a React + Vite SPA for loan applications plus an Express backend for API and admin support.

## Local development

1. Copy env variables:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start local server:
   ```bash
   npm run dev
   ```
4. Open the app in your browser at `http://localhost:3000`.

## Admin access

Local dev fallback token:
- `local-admin-token`

Use the admin route:
- `http://localhost:3000/admin?access_token=local-admin-token`

Once validated, the admin dashboard supports:
- Real-time application phone feed
- Admin user management
- Secure admin access link creation and revocation
- Audit logs for admin events

## Production deployment

1. Set the following environment variables in Vercel or your hosting provider:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_SESSION_SECRET`
   - `APP_URL`
2. Build and deploy.

## Routing fix for `/admin`

This SPA uses an Express server with a final fallback route to serve `index.html` for non-API paths.
`vercel.json` also rewrites non-API routes to `index.html` in production.
