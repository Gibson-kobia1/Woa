# Woa Project - Admin Dashboard

## Overview
This app is a loan application and admin dashboard system for the Woa project.

## Tech Stack
- Frontend: React + Vite
- Backend: Node/TypeScript
- Database: Supabase (PostgreSQL)
- Hosting: Vercel

## Supabase Configuration
- URL: https://wofzkllfanwpxhbpdeyq.supabase.co
- Anon Key: [stored in env]
- Service Role Key: [stored in env]

## Environment Variables Required
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

## Main Features
1. Loan calculator and applicant workflow
2. Admin dashboard with real-time visibility
3. Verification code handling

## Admin Realtime Feature
The `recovery/owner-recovery` branch replays the admin realtime and verification code changes from the owner account for deployment.

## File Structure
- `src/`: React components and app source
- `src/supabaseClient.ts`: Supabase client initialization
- `src/components/`: UI screens and admin pages
- `server.ts`: backend server logic

## Build Commands
- Dev: npm run dev
- Build: npm run build
- Start: npm start

## Deployment Notes
- Vercel Hobby Plan limitation: commit author must be repo owner
- Use only owner account commits for production deploys

## Current Status
- Error: supabaseUrl is required
- Fix applied: debug logs added in Supabase client initialization
- No hardcoded Supabase URL found in source files
