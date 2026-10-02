# Atlas

Internal CRM and sales operations for Arcadian × Gllarix. A separate Vite + React app from the website, meant to run on its own subdomain (e.g. `crm.gllarix.com`).

The screen specs, data model and business rules come from the Atlas spec pack (`CRM_BUILD_PROMPT.md` Part A and `screens/*.md`). The spec's FastAPI/HTMX stack was replaced with React + Supabase; everything else (screens, rules, roles, tokens) is followed as written.

## Run locally

```bash
cd atlas
npm install
cp .env.example .env.local
npm run dev
```

Open http://atlas.localhost:8081 (browsers resolve `*.localhost` to your machine, so this behaves like the real subdomain).

## Demo mode

With `VITE_ATLAS_DATA=demo` (the default), Atlas runs on fake seeded data stored in your browser: no database needed. Every demo account uses the password from `VITE_DEMO_PASSWORD` (`atlas-demo` by default).

| Email | Role | Notes |
|---|---|---|
| rinor@atlas.test | Admin | |
| artin@atlas.test | Admin | Co-founder, queue capacity 80 |
| diego@atlas.test | BDR | Queue capacity 150 |
| lena@atlas.test | Implementer | |
| books@atlas.test | Viewer | |
| former@atlas.test | BDR | Paused: shows "Your access is paused" |

To reset demo data, clear the site's local storage for `atlas.localhost:8081`.

## Supabase mode

Atlas has its own Supabase project, `lwlhokpohocjbolzozzb`, separate from the website. One-time setup:

1. **Apply the schema.** Either run each file in `supabase/migrations/` in order in the dashboard's SQL editor, or with the CLI from `atlas/`:
   ```bash
   npx supabase login
   npx supabase link --project-ref lwlhokpohocjbolzozzb
   npx supabase db push
   ```
2. **Auth settings** (Authentication → Sign In / Providers and URL Configuration): turn off "Allow new users to sign up", set Site URL to `https://crm.gllarix.com`, and add `http://atlas.localhost:8081` as a redirect URL. (`npx supabase config push` applies the same from `supabase/config.toml`.)
3. **Founders:** put your emails in `supabase/bootstrap_admins.sql`, run it in the SQL editor, then invite the same emails from Authentication → Users.
4. Set `VITE_ATLAS_DATA=supabase` in `.env.local` and restart `npm run dev`.

Only the **publishable** key goes in the app. The secret key belongs in Edge Function secrets, never in a `VITE_` variable.

## Deploying to crm.gllarix.com

Create a second Vercel project from this repo with **Root Directory = `atlas`** (framework Vite), add the three `VITE_*` variables with `VITE_ATLAS_DATA=supabase`, and attach the domain `crm.gllarix.com`. `vercel.json` handles SPA routing and keeps the app out of search engines.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 8081 |
| `npm test` | Vitest suite |
| `npm run typecheck` | TypeScript, no emit |
| `npm run build` | Typecheck + production build |

## Layout

```
src/
  data/          DataSource interface; demo (seeded, browser-only) and Supabase implementations
  auth/          Session context
  lib/           nav + role access, safe redirects, hotkeys
  components/
    shell/       Sidebar, top bar, app shell (G-shortcuts, ⌘K, notifications polling)
    overlays/    Command palette, notifications panel
    ui/          Buttons/chips/badges/KPI card/empty/skeleton, modal, drawer, toast
  pages/         Login, style guide, admin, 403/404, placeholders for later milestones
  styles/        tokens.css (from the spec pack) + component layer
supabase/migrations/  SQL migrations with RLS
docs/            QUESTIONS.md, SCREENS_STATUS.md
```

Colors only come from `src/styles/tokens.css` via Tailwind (`bg-surface`, `text-cyan`, …). New components go on `/styleguide` in the same change.
