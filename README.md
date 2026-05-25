# Balaji Bill Generator

Point-of-sale billing app for Balaji Ji Food Arts with menu management, receipt PDF download, sales analytics API integration, and a local Windows print service for thermal and kitchen printers.

## Current Release Status

The Next.js production build passes:

```bash
npm run build
```

Verified on May 25, 2026 with Next.js 14.2.5. The build produced static routes for `/`, `/admin`, `/admin/login`, `/admin/menu`, and `/admin/menu/import`.

Before going live, review these open launch items:

- `npm run lint` is not production-ready yet because `next lint` opens the interactive ESLint setup prompt. Add an ESLint config before relying on lint in CI or deployment checks.
- `app/page.js` still contains a `debugger;` statement inside the print flow. Remove it before live use so printing cannot pause when browser devtools are open.
- The repository does not include the backend API server. This frontend expects an external API at `NEXT_PUBLIC_API_URL`, proxied through `/api/*` by `next.config.mjs`.
- Admin route protection is handled by backend `/api/auth/me` calls from the admin pages. `middleware.js` currently does not block unauthenticated `/admin` navigation by itself.
- Local printing requires the print service on the machine connected to the printers. Browser printing calls `http://localhost:5000`, so the service must be running on each POS machine.

## Tech Stack

- Next.js 14 and React 18
- Tailwind CSS
- Local print service: Node.js, Express, `pdf-to-printer`, `pdfkit`
- Receipt generation: `html2canvas`, `jspdf`
- External backend API expected for auth, sales, analytics, categories, menu, and import endpoints

## Project Structure

- `app/` Next.js app routes
- `components/` POS, receipt, and admin UI components
- `services/` frontend API wrappers
- `utils/` shared billing calculations
- `data/` local menu data
- `print-service/` local Windows printer service
- `main.js` Electron entry that starts the print service

## Environment

Copy the sample env file:

```bash
copy .env.example .env.local
```

Required frontend variables:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

Local print service variables are also read from `.env.local` or `.env`:

```env
PRINT_MAIN_THERMAL=POS-X Thermal Printer
PRINT_LAN_1=Continental
PRINT_LAN_2=Chaap
PRINT_ALLOW_DUPLICATE_TARGETS=false
```

For local testing with one virtual printer:

```env
PRINT_MAIN_THERMAL=CutePDF Writer
PRINT_LAN_1=CutePDF Writer
PRINT_LAN_2=CutePDF Writer
PRINT_ALLOW_DUPLICATE_TARGETS=true
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the Next.js app:

```bash
npm run dev
```

Start the print service in a second terminal:

```bash
npm run print-service
```

Open:

- App: `http://localhost:3000`
- Print service health check: `http://localhost:5000`
- Print diagnostics: `http://localhost:5000/diagnose`
- Test print: `http://localhost:5000/test-print`

## Production Build

Build:

```bash
npm run build
```

Start:

```bash
npm run start
```

## Deployment Notes

For Vercel or another Next.js host:

- Build command: `npm run build`
- Start command, if needed: `npm run start`
- Set `NEXT_PUBLIC_API_URL` to the deployed backend API origin.
- Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` if Google login is enabled.
- Make sure the backend allows the deployed frontend origin in CORS/cookie settings.

The local print service is not hosted on Vercel. It must run on the Windows POS machine because the browser sends print jobs to `http://localhost:5000`.

## Printer Setup

Every configured printer must exist as a Windows printer queue with the exact configured name. The current print flow sends:

- `MAIN_THERMAL`: 2 customer copies
- `LAN_1`: 1 kitchen copy
- `LAN_2`: 1 kitchen copy

Run diagnostics before live billing:

```bash
curl http://localhost:5000/diagnose
```

The response should show no `missing_printers`, no `blocked_printers`, and no duplicate targets unless `PRINT_ALLOW_DUPLICATE_TARGETS=true` is intentional.

## Live Checklist

- Production build passes with `npm run build`.
- `.env.local` has the correct backend URL and Google client ID.
- Backend API is deployed and reachable through `/api/*`.
- Admin login works with email/password and Google if enabled.
- Sale creation works and appears in analytics/admin.
- Menu categories and items load from the backend.
- Printer queues match `PRINT_MAIN_THERMAL`, `PRINT_LAN_1`, and `PRINT_LAN_2`.
- `npm run print-service` is running on the POS machine.
- `/diagnose` reports all printers ready.
- `/test-print` prints successfully.
- A real bill prints all expected copies.
- Browser devtools are closed or the `debugger;` statement is removed before live use.
- ESLint is configured if lint will be used in deployment checks.

## Security Notes

- Do not commit `.env`, `.env.local`, logs, `.next/`, `dist/`, or `node_modules/`.
- Use HTTPS for the deployed backend and frontend.
- Keep backend CORS and cookie settings restricted to trusted frontend domains.
- Rotate any secret that was ever committed or shared outside the deployment environment.
