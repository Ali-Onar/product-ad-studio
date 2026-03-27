# Product Ad Studio — Product Requirements Document (PRD)

## 1. Overview

**Product Ad Studio** is an AI-powered visual and video ad generation platform for e-commerce sellers and marketing teams. Users upload product photos, and the platform generates professional product photos and animated video ads via AI models.

### Vision

Democratize professional ad content creation for e-commerce sellers. Replace expensive photography and video production with AI-powered generation that completes in seconds.

### Target Audience

- E-commerce platform sellers (Trendyol, Hepsiburada, Amazon, Shopify, etc.)
- Individual sellers on social media platforms
- Marketing teams and agencies

## 2. Core Features

### 2.1 AI Product Photo Generation (MVP)

- User uploads a product photo
- AI generates professional-style product photos (different backgrounds, angles, styles)
- Uses Wiro API — Product Photoshoot model
- **Model:** https://wiro.ai/models/wiro/product-photoshoot

### 2.2 AI Video Ad Generation (MVP)

- Animated video ad generation from a product photo
- Output in social media-ready formats (9:16, 1:1, 16:9)
- Uses Wiro API — Product Ads model
- **Model:** https://wiro.ai/models/wiro/product-ads

### 2.3 Future Features

- **URL-to-Video:** Automatic video ad generation from a product page URL
- **AI Avatar:** AI avatar integration for product presentations
- Batch processing
- Brand templates and consistency
- A/B test variations

## 3. User Flows

### 3.1 Registration & Login

1. User registers with email/password (Supabase Auth)
2. Account activates after email verification
3. Redirected to dashboard after login

### 3.2 Product Photo Generation

1. User selects "New Photo" from the dashboard
2. Uploads a product photo (Supabase Storage)
3. Selects style, background, and other parameters
4. AI generation starts (Wiro API)
5. Results are displayed; user can download or request edits

### 3.3 Video Ad Generation

1. User selects an existing product photo or uploads a new one
2. Selects video format (9:16, 1:1, 16:9)
3. Chooses animation style and other parameters
4. AI video generation starts (Wiro API)
5. Video preview is shown; user can download

### 3.4 Credit / Subscription Management

1. User selects a plan (Lemon Squeezy)
2. Payment is processed
3. Credit balance is updated
4. Each generation consumes credits

## 4. Technical Architecture

### 4.1 Frontend

| Technology | Usage |
|---|---|
| Next.js 16 (App Router) | Framework, SSR/SSG, API routes |
| React 19 | UI library |
| TypeScript 5 | Type safety |
| TailwindCSS | Styling |
| shadcn/ui | UI component library |
| React Hook Form + Zod | Form management and validation |
| TanStack Table | Data tables (generation history, etc.) |

### 4.2 Backend & Services

| Technology | Usage |
|---|---|
| Supabase Auth | Authentication |
| Supabase Database (PostgreSQL) | User data, generation history, credit balances |
| Supabase Storage | Product photo uploads |
| Wiro API | AI model integration (photo and video generation) |
| Lemon Squeezy | Payment and subscription management |
| Resend | Transactional email (if needed) |

### 4.3 Infrastructure & DevOps

| Technology | Usage |
|---|---|
| Cloudflare Workers | Edge functions, API proxy |
| Cloudflare R2 | Storage for generated images/videos |
| Cloudflare DNS | Domain management |
| Cloudflare Bot Protection | Security |

## 5. Database Schema (Draft)

### profiles

| Column | Type | Description |
|---|---|---|
| id | uuid (PK, FK → auth.users) | User ID |
| full_name | text | Full name |
| avatar_url | text | Profile photo |
| credits | integer | Remaining credits |
| plan | text | Subscription plan |
| created_at | timestamptz | Created at |

### generations

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Generation ID |
| user_id | uuid (FK → profiles) | User |
| type | text | 'photo' or 'video' |
| status | text | 'pending', 'processing', 'completed', 'failed' |
| input_image_url | text | Uploaded product photo |
| output_urls | text[] | Generated file URLs |
| parameters | jsonb | Generation parameters |
| credits_used | integer | Credits consumed |
| created_at | timestamptz | Created at |

### subscriptions

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Subscription ID |
| user_id | uuid (FK → profiles) | User |
| lemon_squeezy_id | text | Lemon Squeezy subscription ID |
| plan | text | Plan name |
| status | text | 'active', 'cancelled', 'past_due' |
| current_period_end | timestamptz | Current period end |
| created_at | timestamptz | Created at |

## 6. API Integrations

### 6.1 Wiro API

- **Product Photoshoot:** Product photo generation
- **Product Ads:** Video ad generation
- API key used securely on the server-side
- Async processing: result tracking via webhook or polling

### 6.2 Lemon Squeezy

- Checkout session creation
- Subscription status tracking via webhooks
- Credit loading and plan management

### 6.3 Resend (Optional)

- Welcome email
- Generation completed notification
- Subscription notifications

## 7. Page Structure

```
/                         → Landing page
/auth/login               → Login
/auth/sign-up             → Registration
/auth/forgot-password     → Password reset
/dashboard                → Main panel (generation history, credit status)
/dashboard/generate       → Start new generation
/dashboard/history        → Generation history (TanStack Table)
/dashboard/settings       → Account settings
/pricing                  → Pricing plans
```

## 8. MVP Scope

**Included:**
- Email/password registration and login
- Product photo upload
- AI product photo generation (Wiro Product Photoshoot)
- AI video ad generation (Wiro Product Ads)
- Generation history view
- Basic credit system (monthly subscription)
- Payment via Lemon Squeezy
- Responsive design

**Excluded (Post-MVP):**
- URL-to-video
- AI avatar
- Batch processing
- Team/organization management
- OAuth login (Google, GitHub)
- Advanced analytics
