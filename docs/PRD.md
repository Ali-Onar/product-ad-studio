# Product Ad Studio — Ürün Gereksinim Dokümanı (PRD)

## 1. Genel Bakış

**Product Ad Studio**, e-ticaret satıcıları ve pazarlama ekipleri için AI destekli görsel ve video reklam üretim platformudur. Kullanıcılar ürün fotoğraflarını yükler, platform AI modelleri aracılığıyla profesyonel ürün fotoğrafları ve animasyonlu video reklamlar üretir.

### Vizyon

Profesyonel reklam içeriği üretimini e-ticaret satıcıları için erişilebilir kılmak. Pahalı fotoğraf çekimi ve video prodüksiyonunun yerine, saniyeler içinde tamamlanan AI destekli üretimi koymak.

### Hedef Kitle

- E-ticaret platformu satıcıları (Trendyol, Hepsiburada, Amazon, Shopify vb.)
- Sosyal medya platformlarındaki bireysel satıcılar
- Pazarlama ekipleri ve ajanslar

## 2. Temel Özellikler

### 2.1 AI Ürün Fotoğrafı Üretimi (MVP)

- Kullanıcı bir ürün fotoğrafı yükler
- AI profesyonel tarzda ürün fotoğrafları üretir (farklı arka planlar, açılar, stiller)
- Wiro API — Product Photoshoot modeli kullanılır
- **Model:** https://wiro.ai/models/wiro/product-photoshoot

### 2.2 AI Video Reklam Üretimi (MVP)

- Ürün fotoğrafından animasyonlu video reklam üretimi
- Sosyal medyaya hazır formatlarda çıktı (9:16, 1:1, 16:9)
- Wiro API — Product Ads modeli kullanılır
- **Model:** https://wiro.ai/models/wiro/product-ads

### 2.3 Gelecek Özellikler

- **URL-to-Video:** Ürün sayfası URL'inden otomatik video reklam üretimi
- **AI Avatar:** Ürün tanıtımları için AI avatar entegrasyonu
- Batch processing (toplu işlem)
- Marka şablonları ve tutarlılık
- A/B test varyasyonları

## 3. Kullanıcı Akışları

### 3.1 Kayıt & Giriş

1. Kullanıcı e-posta/şifre ile kayıt olur (Supabase Auth)
2. E-posta doğrulaması sonrası hesap aktifleşir
3. Giriş sonrası dashboard'a yönlendirilir

### 3.2 Ürün Fotoğrafı Üretimi

1. Kullanıcı dashboard'dan "New Photo" seçer
2. Ürün fotoğrafı yükler (Supabase Storage)
3. Stil, arka plan ve diğer parametreleri seçer
4. AI üretimi başlar (Wiro API)
5. Sonuçlar gösterilir; kullanıcı indirebilir veya düzenleme talep edebilir

### 3.3 Video Reklam Üretimi

1. Kullanıcı mevcut bir ürün fotoğrafını seçer veya yeni bir tane yükler
2. Video formatını seçer (9:16, 1:1, 16:9)
3. Animasyon stilini ve diğer parametreleri belirler
4. AI video üretimi başlar (Wiro API)
5. Video önizlemesi gösterilir; kullanıcı indirebilir

### 3.4 Kredi / Abonelik Yönetimi

1. Kullanıcı bir plan seçer (Lemon Squeezy)
2. Ödeme işlenir
3. Kredi bakiyesi güncellenir
4. Her üretim kredi harcar

## 4. Teknik Mimari

### 4.1 Frontend

| Teknoloji | Kullanım |
|---|---|
| Next.js 16 (App Router) | Framework, SSR/SSG, API route'ları |
| React 19 | UI library |
| TypeScript 5 | Type safety |
| TailwindCSS | Styling |
| shadcn/ui | UI component library |
| React Hook Form + Zod | Form yönetimi ve validation |
| TanStack Table | Data table'lar (üretim geçmişi vb.) |

### 4.2 Backend & Servisler

| Teknoloji | Kullanım |
|---|---|
| Supabase Auth | Authentication |
| Supabase Database (PostgreSQL) | Kullanıcı verileri, üretim geçmişi, kredi bakiyeleri |
| Supabase Storage | Ürün fotoğrafı yüklemeleri ve üretim çıktıları |
| Wiro API | AI model entegrasyonu (fotoğraf ve video üretimi) |
| Lemon Squeezy | Ödeme ve abonelik yönetimi |
| Resend | Transactional e-posta (gerekirse) |

### 4.3 Altyapı & DevOps

| Teknoloji | Kullanım |
|---|---|
| Railway | Deploy platformu — uygulama hosting'i (Next.js Node.js server) |
| Supabase Storage | Üretilen görsel/videolar ve kullanıcı yüklemeleri (private `generations` bucket) |
| Cloudflare DNS | Domain yönetimi |
| Cloudflare Bot Protection | Güvenlik |
| Cloudflare R2 | *(İleride)* Blog thumbnail'leri, görseller ve projenin public dosyaları |

**Kararlar:**

- **Cloudflare Workers kullanılmıyor.** Wiro API çağrıları Next.js route handler'ları üzerinden server tarafında yapılır; ayrı bir edge katmanına ihtiyaç yok.
- **Deploy platformu Railway.** Proxy ve route handler'lar Node.js runtime'da çalışır.
- **Üretim çıktıları Supabase Storage'da.** Private bucket + signed URL; RLS ile aynı yetkilendirme modeli kullanılır.
- **Cloudflare R2 ileriye dönük.** Blog altyapısı (faz 10) ve public statik dosyalar için değerlendirilecek — kullanıcıya özel üretim çıktıları için değil.

## 5. Database Şeması

Şema tek kaynaktan yönetilir: [`supabase/migrations/20260331120000_initial_schema.sql`](../supabase/migrations/20260331120000_initial_schema.sql).
TypeScript type'ları buradan generate edilir ve `types/database.types.ts` içinde tutulur. Kolon ve policy detayları için migration dosyasına bakılmalı — burada tekrarlanmaz.

**Tablolar:** `user_profiles`, `credit_balances`, `credit_transactions`, `subscriptions`, `generations`
**Enum'lar:** `subscription_status`, `generation_status`, `generation_model`, `credit_transaction_type`
**Fonksiyonlar:** `handle_new_user()`, `check_and_deduct_credits()`, `add_credits()`, `handle_updated_at()`
**Storage:** private `generations` bucket

Migration'dan okunamayan, ürün tarafını ilgilendiren iki karar:

- Üretim dosyaları public URL olarak değil **storage path** olarak saklanır; bucket private'tır, gösterim ve indirme için signed URL üretilir.
- Kredi düşümü `check_and_deduct_credits()` ile atomik yapılır (satır `FOR UPDATE` ile kilitlenir); uygulama katmanında bakiye okuyup ayrıca güncelleme yapılmaz.

## 6. API Entegrasyonları

### 6.1 Wiro API

- **Base URL:** `https://api.wiro.ai/v1`
- **Auth:** Signature-based, yalnızca server tarafında. Üç header zorunlu:
  - `x-api-key` (`WIRO_API_KEY`)
  - `x-nonce` — unix timestamp
  - `x-signature` — `HMAC-SHA256(mesaj = WIRO_API_SECRET + NONCE, key = WIRO_API_KEY)`, hex
- **Çalıştırma:** `POST /Run/wiro/product-photoshoot` → `{ result, errors, taskid, socketaccesstoken }`
  - **Product Photoshoot:** Ürün fotoğrafı üretimi
  - **Product Ads:** Video reklam üretimi
- **Takip:** `POST /Task/Detail` (`taskid` veya `tasktoken` ile) → `tasklist[0].status` + `pexit` + `outputs[]`
  - Terminal status'ler: `task_postprocess_end`, `task_cancel`, `task_error`
  - Başarı ölçütü `pexit === "0"`; başarısız task ücretlendirilmez
- **Callback:** İsteğe bağlı `callbackUrl` parametresi — task bitince Wiro sonucu POST eder. **Şu an kullanılmıyor**, sonuç takibi client polling ile yapılıyor (4 saniyede bir `syncGeneration` server action'ı)
- **Input dosyası:** Model dosyayı kendi indirir, bu yüzden private bucket'taki görsel için kısa ömürlü signed URL verilir
- **Çıktı dosyası:** Wiro'nun CDN URL'i tahmin edilemez ama **auth'suz erişilebilir** ve saklama süresi bizim kontrolümüzde değil. Bu yüzden çıktı sunucu tarafında indirilip kendi private bucket'ımıza yazılır (`output_storage_paths`), kullanıcıya signed URL ile sunulur
- **Not:** Wiro hataları HTTP 200 + `result: false` olarak da dönebilir; iki kontrol de yapılır

### 6.2 Lemon Squeezy

- Checkout session oluşturma
- Webhook'lar ile abonelik durumu takibi
- Kredi yükleme ve plan yönetimi

### 6.3 Resend (Opsiyonel)

- Hoş geldin e-postası
- Üretim tamamlandı bildirimi
- Abonelik bildirimleri

## 7. Sayfa Yapısı

**Public (proxy tarafından korunmaz):**

```
/                         → Landing page
/pricing                  → Fiyatlandırma planları
/about                    → Hakkımızda
/contact                  → İletişim
/blog, /blog/[slug]       → Blog
/auth/login               → Giriş
/auth/sign-up             → Kayıt
/auth/forgot-password     → Şifre sıfırlama
/auth/update-password     → Şifre güncelleme
/auth/confirm             → E-posta/OAuth doğrulama (route handler)
```

**Protected (`/dashboard` prefix'i — oturum zorunlu):**

```
/dashboard                → Ana panel (özet, kredi durumu)
/dashboard/image          → Image Studio (Wiro Product Photoshoot)
/dashboard/video          → Video Studio (Wiro Product Ads)
/dashboard/history        → Üretim geçmişi (TanStack Table)
/dashboard/settings       → Hesap ayarları, profil, kredi geçmişi
```

Route koruması `proxy.ts` içindeki `PROTECTED_PREFIXES` listesiyle yapılır: yalnızca bu prefix'ler oturum ister, geri kalan her şey public'tir. Yeni bir authenticated alan eklenirse prefix bu listeye eklenmelidir. Proxy yalnızca navigation'ları korur — route handler'lar ve server action'lar auth kontrolünü kendileri yapmalıdır.

**Yönlendirme davranışı:**

- Oturumsuz kullanıcı protected bir route'a girerse `/auth/login?next=<hedef>`'e yönlendirilir; giriş sonrası login form kullanıcıyı hedefe geri götürür. `next` değeri yalnızca same-origin path kabul eder (open redirect koruması).
- Oturumu açık kullanıcı `/auth/login` veya `/auth/sign-up`'a girerse `/dashboard`'a yönlendirilir. `/auth/update-password` ve `/auth/confirm` bunun dışındadır — şifre kurtarma akışı bu route'lara authenticated olarak gelir.

## 8. MVP Kapsamı

**Dahil:**
- E-posta/şifre ile kayıt ve giriş
- Ürün fotoğrafı yükleme
- AI ürün fotoğrafı üretimi (Wiro Product Photoshoot)
- AI video reklam üretimi (Wiro Product Ads)
- Üretim geçmişi görüntüleme
- Temel kredi sistemi (aylık abonelik)
- Lemon Squeezy ile ödeme
- Responsive tasarım

**Hariç (MVP Sonrası):**
- URL-to-video
- AI avatar
- Batch processing
- Takım/organizasyon yönetimi
- OAuth ile giriş (Google, GitHub)
- Gelişmiş analytics

## 9. Proje Fazları

| # | Faz | Kapsam | Durum |
|---|---|---|---|
| 1 | Proje tanıtımı + fikir + tech stack kararları | PRD, CLAUDE.md, README, teknoloji seçimleri | ✅ Tamamlandı |
| 2 | Proje kurulumu | Next.js 16, ESLint flat config, Supabase client'ları, shadcn/ui, Tailwind v4, klasör yapısı | ✅ Tamamlandı |
| 3 | Auth | Supabase Auth, login/sign-up/forgot-password/update-password, confirm route, `/dashboard` koruması, `proxy.ts` | ✅ Tamamlandı |
| 4 | Database şeması + Supabase kurulumu | Migration (enum'lar, tablolar, RLS policy'leri, trigger'lar), storage bucket, generated types | ✅ Tamamlandı |
| 5 | Image Studio — UI + Wiro entegrasyonu | Upload UI, parametre formu, Wiro Product Photoshoot API entegrasyonu, kredi düşümü | ✅ Tamamlandı |
| 6 | Image Studio — polling + sonuç gösterimi | Job polling, çıktıyı CDN'den bucket'a indirme, sonuç galerisi, indirme | 🚧 Devam ediyor |
| 7 | Video Studio — Effect picker UI | 150+ preset, video preview, seçim arayüzü | ⬜ Yapılacak |
| 8 | Video Studio — Wiro entegrasyonu + polling | Wiro Product Ads API entegrasyonu, job polling | ⬜ Yapılacak |
| 9 | Dashboard | Geçmiş üretimler, TanStack Table, indirme | ⬜ Yapılacak |
| 10 | Landing page & kurumsal sayfalar | Landing page tasarımı, logo, hakkımızda, iletişim, blog altyapısı | ⬜ Yapılacak |
| 11 | Kredi sistemi | Lemon Squeezy entegrasyonu, webhook, kredi satın alma | ⬜ Yapılacak |
| 12 | Settings & profil | Hesap ayarları, profil, kredi geçmişi | ⬜ Yapılacak |
| 13 | Deploy | Railway üzerinde production deployment | ⬜ Yapılacak |

**Durum açıklamaları:** ✅ Tamamlandı · 🚧 Devam ediyor · ⬜ Yapılacak
