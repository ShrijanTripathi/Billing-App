# Balaji Billing SaaS

Production-ready full-stack billing platform with an admin control panel and sales analytics.

## Features

- Billing system for fast order creation and receipt generation
- Admin analytics with day/week/month revenue insights
- Offline sales control for manual correction and deletion workflows
- Menu and category management from the admin dashboard
- Secure auth with HTTP-only JWT cookie and optional Google sign-in

## Tech Stack

- Frontend: Next.js 14, React 18, Tailwind CSS
- Backend: Node.js, Express
- Database: MongoDB (Mongoose)
- Auth: JWT + Google Identity Services
- Deployment: Vercel (frontend) + external backend host

## Project Structure

- `app/` Next.js app routes and UI pages
- `components/` reusable React UI components
- `services/` frontend service layer (API client)
- `utils/` shared frontend utility functions
- `backend/` Express server (acts as `server/`)
- `backend/src/config` backend env and DB config
- `backend/src/controllers` backend route handlers
- `backend/src/routes` backend API routes

## Environment Setup

1. Copy root env template:
   - `.env.example` -> `.env.local` (frontend variables)
2. Copy backend env template:
   - `backend/.env.example` -> `backend/.env` (backend variables)
3. Configure all required keys with real values:
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRY`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `GOOGLE_CLIENT_ID`
   - `ALLOWED_ORIGINS`

## Local Development

1. Install dependencies:
   - `npm install`
   - `npm --prefix backend install`
2. Run frontend:
   - `npm run dev`
3. Run backend:
   - `npm --prefix backend run dev`
4. Open app:
   - Frontend at `http://localhost:3000`
   - Backend should be reachable through `NEXT_PUBLIC_API_URL`

## Build

- Frontend production build:
  - `npm run build`
- Frontend production start:
  - `npm run start`
- Backend production start:
  - `npm --prefix backend run start`

## Vercel Deployment

1. Push repository to GitHub.
2. Import repo in Vercel.
3. Configure root project on Vercel:
   - Build command: `npm run build`
   - Output: Next.js default
4. Add Vercel environment variables:
   - `NEXT_PUBLIC_API_URL` = your deployed backend URL
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = your Google OAuth client ID
5. Deploy backend on a Node host (Render, Railway, Fly.io, etc.) with:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRY`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `GOOGLE_CLIENT_ID`
   - `ALLOWED_ORIGINS` including your Vercel domain

## Security Notes

- Never commit `.env`, `.env.local`, or `backend/.env`.
- Rotate any previously exposed secrets before production deploy.
- Keep `ALLOWED_ORIGINS` restricted to trusted frontend domains.
