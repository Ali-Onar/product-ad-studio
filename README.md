# Product Ad Studio

AI-powered visual and video ad generation for e-commerce sellers. Upload a product photo and generate professional product shots and animated video ads.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS v4, shadcn/ui (new-york), `next-themes`
- **Auth / DB / Storage:** Supabase (`@supabase/ssr`)
- **AI Models:** Wiro API (Product Photoshoot, Product Ads)
- **Payments:** Lemon Squeezy
- **Forms:** React Hook Form + Zod
- **Tables:** TanStack Table

## Getting Started

Install dependencies:

```bash
npm install
```

Copy the environment template and fill in your Supabase project values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |

Both are available under **Project Settings → API** in the [Supabase dashboard](https://supabase.com/dashboard).

Start the dev server:

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

No test framework is configured yet.

## Project Structure

```
app/
  auth/           Authentication pages and the email/OAuth confirm route
  protected/      Authenticated-only routes (redirects to /auth/login)
components/
  ui/             shadcn/ui primitives
lib/
  supabase/       Browser, server, and middleware Supabase clients
types/            Generated Supabase database types
supabase/         SQL migrations
```

Styling is configured CSS-first in `app/globals.css` — Tailwind v4 has no `tailwind.config.ts`. Design tokens are defined as CSS variables and exposed to Tailwind through `@theme inline`.

See [CLAUDE.md](CLAUDE.md) for architecture notes and code conventions.
