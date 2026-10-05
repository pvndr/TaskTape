# TaskTape 📋🏷️

A tactile checklist web app with a masking-tape aesthetic on kraft paper, built as an installable Progressive Web App (PWA).

## Features

- **Masking-Tape Aesthetic**: Strips with torn ends, subtle drop shadows, and stable slight rotations (+/- 1° to 2°) mimicking real tape.
- **Handwritten Typography**: Locally bundled Caveat font for tape labels; clean system sans-serif for controls.
- **5 Tape Colors**: Cream, Red, Mustard, Teal, and Sage.
- **Optimistic UI & Caching**: Immediate UI response with rollbacks on failure; instant paint via localStorage cached by user ID.
- **Undo Deletions**: Deleting a strip provides an instant 5-second Undo snackbar before committing permanent deletion to Supabase.
- **Installable PWA**: Standalone display mode, auto-updating service worker, offline precaching of app shell and fonts.
- **Authentication**: Email + password sign up and sign in backed by Supabase with Row-Level Security (RLS).
- **Mobile-First UX**: Add bar pinned inside thumb reach with iOS safe-area support, inputs sized to prevent iOS Safari auto-zoom, and dynamic viewport units (`dvh`).

---

## Local Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> **Supabase Table Requirements**:
> Ensure your Supabase database has the `tasks` table with Row-Level Security (RLS) enabled:
> - `id` (uuid or text, primary key)
> - `user_id` (uuid, references `auth.users`)
> - `title` (text)
> - `done` (boolean, default `false`)
> - `color` (text, default `'tape-cream'`)
> - `created_at` (timestamptz, default `now()`)
> - `completed_at` (timestamptz, nullable)
> - `deleted_at` (timestamptz, nullable)
>
> *(Optional for Supabase sync of Recurring Tapes)* `recurring_tasks` table:
> - `id` (uuid or text, primary key)
> - `user_id` (uuid, references `auth.users`)
> - `title` (text)
> - `color` (text, default `'tape-teal'`)
> - `created_at` (timestamptz, default `now()`)
> - `last_spawned_date` (text, nullable)

### 3. Run Locally
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Deployment (Netlify or Cloudflare Pages)

1. **Build Command**: `npm run build`
2. **Publish / Output Directory**: `dist`
3. **Environment Variables**:
   In your hosting dashboard (Netlify Site Configuration > Environment variables, or Cloudflare Pages Settings > Environment variables), configure:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
