# CLAUDE.md

Bu dosya, bu repository üzerinde çalışırken Claude Code'a (claude.ai/code) rehberlik eder.

## Proje Özeti

Product Ad Studio — e-ticaret satıcıları için AI destekli görsel ve video reklam üretim platformu (SaaS). Kullanıcılar ürün fotoğraflarını yükler, AI profesyonel ürün fotoğrafları ve animasyonlu video reklamlar üretir.

Next.js 16 (App Router), React 19, TypeScript 5, Supabase, TailwindCSS ve shadcn/ui üzerine kuruludur.

### Temel Kurallar

- **Dil**: Tüm UI metinleri İngilizce olmalı
- **Commit**: Commit mesajları her zaman İngilizce yazılır
- **UI Library**: Önce shadcn/ui, gerekmedikçe ek Radix primitive kullanılmaz
- **Tablolar**: shadcn Data Table (TanStack Table) kullanılır
- **State**: Supabase client yeterli, TanStack Query gerekli değil (şimdilik)
- **ESLint**: `eslint.config.mjs` içindeki kurallara her zaman uyulur — commit öncesi `npm run lint` çalıştır

## Komutlar

- **Dev server:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint` (ESLint flat config, v9+)
- **Test framework tanımlı değil.**

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5, TailwindCSS, shadcn/ui
- **Auth / DB / Storage:** Supabase (Auth, Database, Storage)
- **AI Models:** Wiro API (Product Photoshoot, Product Ads)
- **Payments:** Lemon Squeezy
- **Forms & Validation:** React Hook Form, Zod
- **Data Tables:** TanStack Table
- **Email:** Resend (gerekirse)
- **Infrastructure:** Cloudflare (Workers, R2 storage, DNS, bot protection)

## Mimari

### Routing (App Router)

- `app/` — Next.js App Router sayfaları ve layout'ları
- `app/auth/` — Authentication sayfaları (login, sign-up, forgot-password, update-password) ve OAuth/email doğrulaması için `confirm/route.ts` API route'u
- `app/dashboard/` — Yalnızca authenticated kullanıcılara açık route'lar; oturumu olmayan kullanıcılar `proxy.ts` tarafından `/auth/login`'e yönlendirilir
- Diğer tüm route'lar (landing page, pricing, about, contact, blog) public'tir

### Authentication

- `@supabase/ssr` üzerinden Supabase SSR entegrasyonu
- `lib/supabase/client.ts` — browser tarafı Supabase client
- `lib/supabase/server.ts` — cookie tabanlı session'lar ile server tarafı client
- `proxy.ts` (proje kökü) — Next.js 16 Proxy dosyası (eski adıyla `middleware.ts`). Route policy'si burada: `PROTECTED_PREFIXES` listesindeki prefix'ler oturum ister, geri kalan her şey public'tir. Yeni bir authenticated alan eklenirse prefix bu listeye eklenmelidir. Oturumsuz kullanıcı `/auth/login?next=<hedef>`'e, oturumu açık kullanıcı `SIGNED_OUT_ONLY_ROUTES` üzerinden `/dashboard`'a yönlendirilir
- `lib/supabase/proxy.ts` — `updateSession()`: session cookie'lerini yeniler ve `{ response, isAuthenticated }` döner. Redirect kararı vermez, o `proxy.ts`'in işidir
- `components/` içindeki auth form'ları client component'tir (`"use client"`); `AuthButton` gibi auth kontrolleri server component'tir
- Proxy yalnızca navigation'ları korur — route handler'lar ve server action'lar auth kontrolünü **kendileri** yapmalıdır

### AI Entegrasyonu

- Wiro API üzerinden iki model:
  - **Product Photoshoot:** https://wiro.ai/models/wiro/product-photoshoot
  - **Product Ads:** https://wiro.ai/models/wiro/product-ads
- `lib/wiro/client.ts` — server tarafı Wiro client'ı (`server-only`). Her istek imzalanır: `x-api-key`, `x-nonce` (unix timestamp) ve `x-signature` = `HMAC-SHA256(mesaj = API_SECRET + NONCE, key = API_KEY)`. Dikkat: HMAC key'i **API key**, mesajın parçası ise **secret** — ters değil. Wiro hataları HTTP 200 + `result: false` olarak da gelebilir, ikisi de kontrol edilir
- `lib/wiro/types.ts` — task status'leri ve response tipleri
- `lib/generation/product-photoshoot.ts` — model parametreleri (Wiro JSON schema'sının aynası), Zod schema'ları, kredi maliyeti, form alan config'i
- Private bucket'taki input görseli Wiro'ya kısa ömürlü **signed URL** ile verilir
- İleride: URL-to-video ve AI avatar özellikleri

### Kredi Sistemi

- Bakiye ve hareketler `credit_balances` / `credit_transactions` tablolarında
- `check_and_deduct_credits()` ve `add_credits()` **yalnızca service_role** ile çağrılabilir — bu fonksiyonlar user id'yi parametre olarak aldığı için client'a açık bırakılamaz
- Server tarafında `lib/supabase/admin.ts` içindeki `createAdminClient()` kullanılır; oturum doğrulaması **önce** yapılır
- Üretim akışı: satır oluştur → kredi düş → Wiro'yu çağır → başarısızsa iade et ve satırı `failed` işaretle

### UI & Styling

- shadcn/ui (new-york style), component'ler `components/ui/` altında
- CSS variable tabanlı theming ile Tailwind CSS (`next-themes` ile light/dark, class stratejisi)
- Component variant'ları için CVA (class-variance-authority)
- Icon library: `lucide-react`
- `lib/utils.ts` içinden `cn()` export edilir (clsx + tailwind-merge)

### Environment Variables

Zorunlu (bkz. `.env.example`):

| Değişken | Kullanım |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL'i |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `SUPABASE_SECRET_KEY` | Secret key (eski adıyla service_role key); RLS'i bypass eder, tarayıcıya asla verilmez |
| `WIRO_API_KEY` | Wiro project API key — server-side |
| `WIRO_API_SECRET` | Wiro API secret; request imzasında kullanılır — server-side |

## Code Style

- 2 space indentation (ESLint tarafından zorunlu tutulur)
- Type/interface/enum için PascalCase, değişken ve fonksiyonlar için camelCase
- `return` ifadelerinden önce ve block benzeri ifadelerin etrafında boş satır zorunlu
- Object curly spacing: `{ key: value }` (süslü parantez içinde boşluk)
- Path alias: `@/*` proje köküne map edilir
- Varsayılan olarak Server Component; `"use client"` yalnızca gerektiğinde eklenir

### Component Yapısı

- Bir component ~500 satırı geçiyorsa veya bağımsız bir UI bloğuysa (dialog, form section vb.), ayrı bir dosyaya çıkarılır
- Props interface'i component'in hemen üstünde tanımlanır
- Helper fonksiyonlar (formatCurrency vb.) component'in dışında, dosyanın en üstünde yer alır
- `"use client"` yalnızca interaktivite gerektiğinde (state, event handler, hook) kullanılır

### Server Action Pattern'leri

Her server action şu sırayı izler:
1. Supabase client oluştur ve auth kontrolü yap (`if (!user) return { error: "..." }`)
2. Input validation
3. Type-safe data objesi oluştur (`TablesInsert<"products">`, `TablesUpdate<"products">`)
4. Database işlemi + error handling (loglama için `console.error`)
5. Cache invalidation (`revalidatePath`)
6. Başarı sonucunu dön

Return type'ları:
- Tekil işlemler: `{ success?: boolean; error?: string; productId?: string }`
- Toplu işlemler: `{ success: boolean; updatedCount?: number; error?: string }`
- Tüm error mesajları **İngilizce** olmalı

### Hook Pattern'leri

- İsimlendirme: `use<Feature>` (örn. `useProducts`)
- Return interface'i hook fonksiyonundan önce tanımlanır
- State isimlendirmesi: `isLoading` (fetch için `true` ile başlar), `isUpdating` (mutation için `false` ile başlar)
- Error state: `string | null`
- Refetch dışarı açılır: `refetch: fetchFn`

### Error Handling & Bildirimler

- **Toast library**: Sonner (`import { toast } from "sonner"`)
- Başarı: `toast.success("English message")`
- Hata: `toast.error("English message")`
- Async işlemlerde `try/catch/finally` kullan, loading state'i `finally` içinde sıfırla
- Button'lar: `disabled={isLoading}`, metin değişimi: `{isLoading ? "Updating..." : "Confirm"}`
- Data fetching: `{isLoading ? <Skeleton /> : <Content />}`

### Database Types

- `types/database.types.ts` — Supabase tarafından üretilen type'lar
- `types/helper.types.ts` — türetilmiş yardımcı type'lar (`SupabaseDBClient`, `UserProfile` vb.)
