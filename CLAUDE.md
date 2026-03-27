# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Product Ad Studio — AI-powered visual and video ad generation platform (SaaS) for e-commerce sellers. Users upload product photos, AI generates professional product photos and animated video ads.

Built on Next.js 16 (App Router), React 19, TypeScript 5, Supabase, TailwindCSS, and shadcn/ui.

### Core Rules

- **Language**: All UI text must be in English
- **UI Library**: shadcn/ui first, additional Radix primitives only when needed
- **Tables**: Use shadcn Data Table (TanStack Table)
- **State**: Supabase client is sufficient, TanStack Query not needed (for now)
- **ESLint**: Always respect the rules in `eslint.config.mjs` — run `npm run lint` before committing

## Commands

- **Dev server:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint` (ESLint flat config, v9+)
- **No test framework is configured.**

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5, TailwindCSS, shadcn/ui
- **Auth / DB / Storage:** Supabase (Auth, Database, Storage)
- **AI Models:** Wiro API (Product Photoshoot, Product Ads)
- **Payments:** Lemon Squeezy
- **Forms & Validation:** React Hook Form, Zod
- **Data Tables:** TanStack Table
- **Email:** Resend (if needed)
- **Infrastructure:** Cloudflare (Workers, R2 storage, DNS, bot protection)

## Architecture

### Routing (App Router)

- `app/` — Next.js App Router pages and layouts
- `app/auth/` — Authentication pages (login, sign-up, forgot-password, update-password) and `confirm/route.ts` API route for OAuth/email confirmation
- `app/protected/` — Authenticated-only routes; layout redirects unauthenticated users to `/auth/login`

### Authentication

- Supabase SSR integration via `@supabase/ssr`
- `lib/supabase/client.ts` — browser-side Supabase client
- `lib/supabase/server.ts` — server-side client with cookie-based sessions
- `lib/supabase/proxy.ts` (also exported as `proxy.ts`) — Next.js middleware that refreshes sessions and guards protected routes
- Auth forms in `components/` are client components (`"use client"`); auth checks like `AuthButton` are server components

### AI Integration

- Two models via Wiro API:
  - **Product Photoshoot:** https://wiro.ai/models/wiro/product-photoshoot
  - **Product Ads:** https://wiro.ai/models/wiro/product-ads
- Future: URL-to-video and AI avatar features

### UI & Styling

- shadcn/ui (new-york style) with components in `components/ui/`
- Tailwind CSS with CSS-variable-based theming (light/dark via `next-themes`, class strategy)
- CVA (class-variance-authority) for component variants
- Icon library: `lucide-react`
- `lib/utils.ts` exports `cn()` (clsx + tailwind-merge)

### Environment Variables

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`)

## Code Style

- 2-space indentation (enforced by ESLint)
- PascalCase for types/interfaces/enums, camelCase for variables/functions
- Blank lines required before `return` statements and around block-like statements
- Object curly spacing: `{ key: value }` (spaces inside braces)
- Path alias: `@/*` maps to project root
- Server Components by default; add `"use client"` only when needed

### Component Structure

- If a component exceeds ~500 lines or is an independent UI block (dialog, form section, etc.), extract it to a separate file
- Props interface is defined directly above the component
- Helper functions (formatCurrency, etc.) go outside the component, at the top of the file
- `"use client"` only when interactivity is needed (state, event handlers, hooks)

### Server Action Patterns

Every server action follows this order:
1. Create Supabase client and check auth (`if (!user) return { error: "..." }`)
2. Input validation
3. Build type-safe data object (`TablesInsert<"products">`, `TablesUpdate<"products">`)
4. Database operation + error handling (`console.error` for logging)
5. Cache invalidation (`revalidatePath`)
6. Return success

Return types:
- Single operations: `{ success?: boolean; error?: string; productId?: string }`
- Bulk operations: `{ success: boolean; updatedCount?: number; error?: string }`
- All error messages must be in **English**

### Hook Patterns

- Naming: `use<Feature>` (e.g., `useProducts`)
- Return interface is defined before the hook function
- State naming: `isLoading` (starts `true` for fetching), `isUpdating` (starts `false` for mutations)
- Error state: `string | null`
- Expose refetch: `refetch: fetchFn`

### Error Handling & Notifications

- **Toast library**: Sonner (`import { toast } from "sonner"`)
- Success: `toast.success("English message")`
- Error: `toast.error("English message")`
- Use `try/catch/finally` for async operations, reset loading state in `finally`
- Buttons: `disabled={isLoading}`, text swap: `{isLoading ? "Updating..." : "Confirm"}`
- Data fetching: `{isLoading ? <Skeleton /> : <Content />}`

### Database Types

- `lib/types/database.types.ts` — Supabase generated types
