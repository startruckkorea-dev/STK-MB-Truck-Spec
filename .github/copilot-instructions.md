# Copilot Instructions for mb-truck-spec

## Project Overview
- **Stack:** React + Vite + Tailwind CSS frontend, Supabase backend (auth, DB), mammoth for .docx parsing.
- **Key folders:**
  - `src/` — main app code
    - `lib/` — Supabase client (`supabase.js`), docx parser (`parser.js`)
    - `components/` — UI and domain components (e.g., `ModelCard.jsx`, `SpecTable.jsx`, `CompareTable.jsx`)
    - `pages/` — Route-level pages (e.g., `Login.jsx`, `Models.jsx`, `Compare.jsx`, `admin/`)
    - `hooks/` — Custom hooks (e.g., `useAuth.js`, `useModels.js`)
    - `styles/` — CSS (main: `index.css`)
  - `.env.local` — Supabase URL and anon key

## Essential Workflows
- **Start dev server:** `npm run dev`
- **Install dependencies:** `npm install`
- **DB migrations:** Place SQL files in `supabase/migrations/` and apply via Supabase SQL Editor.
- **Authentication:** Use Supabase Auth. After login, redirect by role: `admin` → `/admin`, `sales` → `/models`.
- **.docx parsing:** Use `mammoth` in `parser.js` for admin uploads.

## Key Patterns & Conventions
- **Data fetching:** Use Supabase client from `lib/supabase.js`.
- **Code translation:** Use `code_dict` table to map English codes to Korean for display.
- **Comparison UI:** Highlight differing values in tables with `rgba(0,173,239,0.12)` background.
- **Design:** Follow design language from `CLAUDE.md` and (if present) `mb_truck_spec.html`.
- **Admin flows:**
  - `AdminDict.jsx`: CRUD for `code_dict`.
  - `AdminModels.jsx`: .docx upload → parse → code mapping → user confirms → save.

## Integration Points
- **Supabase:** Used for DB, auth, and storage. Keys in `.env.local`.
- **mammoth:** Used for parsing .docx files in admin model upload.

## References
- See `CLAUDE.md` for full project structure, DB schema, and design system.
- Use `src/components/ui/` for reusable UI patterns.

---
**Example: Model Comparison**
- Use `CompareBar.jsx` and `Compare.jsx` to allow up to 3 models side-by-side. Highlight differences as above.

---
For any new features, follow the folder and component conventions above. When in doubt, check `CLAUDE.md` for requirements and design details.
