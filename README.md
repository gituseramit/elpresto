# 🍕 EL PRESTO PIZZA — Cafeteria Ordering & Operations Platform

A modern, full-stack cafeteria management system built for **EL PRESTO PIZZA** (UCER Campus, Naini, Prayagraj). Includes a customer storefront, live order tracking, a Counter POS terminal, a Kitchen Display System (KDS), an Admin dashboard, and a Delivery Partner portal — all powered by Next.js + Firebase.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?style=flat-square&logo=firebase)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwindcss)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## 📖 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Firebase Setup](#-firebase-setup)
- [Panel Access (Default PINs)](#-panel-access-default-pins)
- [Project Structure](#-project-structure)
- [Available Scripts](#-available-scripts)
- [Deployment](#-deployment)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🛍️ Customer Storefront
- Beautiful glassmorphism landing page with hero, categories, best sellers
- Full menu with live search, category filters, product ratings, and trending section
- Persistent cart with quantity steppers and per-item notes
- Secure checkout with **Razorpay** + **UPI QR** payment options
- Promo code support with validation and usage tracking
- Delivery address picker with **Leaflet map**, radius validation, and auto address resolution
- Live order tracking with gamified XP progress, achievement badges, live rider map, and OTP verification
- User profile with saved addresses, order history, and dish rating modal

### 🧾 Counter POS (Point of Sale)
- Full-featured billing terminal with live Firestore sync
- Menu grouped by category → subcategory, search, and quick-add frequently ordered items
- Take Away / Dine-in / Delivery order types
- Customer linking by phone, per-item notes, discount presets (5% / 10% / ₹20 / ₹50)
- Live orders panel showing ticket age, urgency colors, and one-click status changes
- Cart persistence to `localStorage`, undo on clear, keyboard shortcuts (F1–F8)
- Thermal receipt + KOT printing (58mm)
- Order recall (edit) and duplicate from history

### 👨‍🍳 Kitchen Display System (KDS)
- Real-time order queue with sound alerts on new orders
- Status flow: `pending → preparing → ready → completed`
- Elapsed-time warnings, late-ticket red pulse
- Kitchen notes, KOT reprint, order editing for on-spot orders only
- Manual order creation (POS mode) with source selection (On Spot / Swiggy / Zomato / Website)
- Fullscreen mode, filters (status, source, search), settings for sound/threshold

### 🛵 Delivery Partner Portal
- Distance-priority sorting using Haversine formula
- Card grid view for high-volume order handling
- Live GPS tracking with `watchPosition()` push to Firestore
- Road route + ETA via **LiveMap** (Leaflet + OSRM)
- Call customer, navigate via Google Maps
- OTP-verified delivery completion

### 🛡️ Admin Dashboard
- Live KPIs: today's revenue, order count, active kitchen queue, ready orders
- Full menu CRUD (categories, subcategories, items, availability toggle)
- Real-time live orders dispatch with rider assignment and status override
- Order history with CSV export and thermal reprint
- Sales analytics: revenue trend, category-wise breakdown, top sellers, pie + bar charts (Recharts)
- Promo code management with audit log
- Panel access control — enable/disable each staff panel, change PINs remotely
- Trending section toggle and calculation mode (auto / manual)
- **Database Reset** with automatic pre-wipe backup to `backups` collection

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS, custom glassmorphism design system |
| State | Zustand (cart), React Context (auth) |
| Backend | Firebase (Auth, Firestore, Hosting) |
| Payments | Razorpay + UPI QR (dynamic) |
| Maps | Leaflet + OSRM routing |
| Charts | Recharts |
| Icons | Lucide React |
| Printing | Custom thermal printer module (58mm) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js **18+**
- npm / yarn / pnpm
- A Firebase project with **Firestore** and **Authentication** enabled
- (Optional) Razorpay account for online payments

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/el-presto-pizza.git
cd el-presto-pizza

# Install dependencies
npm install
# or
yarn install
# or
pnpm install

# Copy the environment template
cp .env.example .env.local

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Environment Variables

Create a `.env.local` file in the project root:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Razorpay (optional — for online payments)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key

# UPI (optional — for direct UPI QR payments)
NEXT_PUBLIC_UPI_ID=yourupi@bank
```

> ⚠️ **Never commit `.env.local`** — it's already in `.gitignore`.

---

## 🔥 Firebase Setup

### 1. Create the Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication** → Google + Email/Password
4. Create a **Firestore** database (start in production mode)

### 2. Firestore Collections

The app expects these collections:

| Collection | Purpose |
|---|---|
| `menuItems` | Menu products |
| `categories` | Category hierarchy (with nested subcategories) |
| `orders` | All orders (status, items, payment, delivery) |
| `customers` | Customer profiles (linked by phone) |
| `promoCodes` | Promo code definitions |
| `promoUsage` | Redemption audit log |
| `settings/general` | Store info, delivery hub, radius |
| `settings/panelAccess` | Panel PINs + enabled flags |
| `settings/trending` | Trending section config |
| `backups` | Auto backup before DB reset |
| `resetLogs` | Audit trail of DB resets |

### 3. Firestore Security Rules

Add rules to protect data. Example baseline:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /menuItems/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /categories/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /orders/{doc} {
      allow read: if true;
      allow create: if true;
      allow update: if true;  // restrict per-panel in production
      allow delete: if request.auth != null;
    }
    match /customers/{doc} {
      allow read, write: if request.auth != null;
    }
    match /promoCodes/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /settings/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

> 🛡️ Tighten these before going live. Consider moving staff panels to authenticated-only writes.

### 4. Seed Data
On first visit to `/counter` or `/admin`, the app auto-seeds default categories if the collection is empty.

To seed manually, import your `DUMMY_MENU` array from `@/data/menu` into `menuItems`.

---

## 🔑 Panel Access (Default PINs)

All staff panels are PIN-protected. **Change these immediately after first login.**

| Panel | URL | Default PIN |
|---|---|---|
| Admin Dashboard | `/admin` | `admin9090` |
| Kitchen KDS | `/kitchen` | `kitchen1234` |
| Counter POS | `/counter` | `counter1234` or `1234` |
| Delivery Partner | `/delivery` | `delivery1234` |

> PINs are stored in `settings/panelAccess` and can be updated from **Admin → Panel Access** without code changes.

**Enable/disable panels remotely** — the Admin can toggle any panel on/off, and staff sessions will be force-logged-out in real time.

---

## 📁 Project Structure

```
el-presto-pizza/
├── app/                      # Next.js App Router pages
│   ├── (storefront)/         # Landing, menu, checkout, track, profile
│   ├── admin/                # Admin dashboard
│   ├── counter/              # Counter POS
│   ├── kitchen/              # Kitchen KDS
│   ├── delivery/             # Delivery portal
│   └── api/                  # Razorpay create-order / verify-payment routes
├── components/
│   ├── Menu/                 # Circular3DHero, TrendingNow
│   ├── Map/                  # LiveMap, LocationPicker
│   ├── RatingModal.tsx
│   └── Header.tsx
├── contexts/
│   └── AuthContext.tsx
├── data/
│   └── menu.ts               # DUMMY_MENU + CATEGORIES
├── lib/
│   ├── firebase.ts           # Firebase init
│   ├── printer.ts            # Thermal receipt + KOT
│   ├── categories.ts         # Category seeding helpers
│   ├── panelAuth.ts          # Panel access verification
│   ├── promoService.ts       # Promo validation + usage
│   ├── ratingService.ts      # Product ratings
│   ├── trendingService.ts    # Trending config
│   └── dbResetService.ts     # Backup + reset logic
├── store/
│   └── useCartStore.ts       # Zustand cart
├── public/
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on `localhost:3000` |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint check |

---

## 🚢 Deployment

### Option 1 — Vercel (Recommended)
1. Push your code to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add all **Environment Variables** from `.env.local`
4. Deploy 🎉

### Option 2 — Firebase Hosting
```bash
npm run build
firebase init hosting    # select "out" if using static export, else Next.js SSR via Cloud Functions
firebase deploy
```

### Option 3 — Self-hosted (VPS / Docker)
```bash
npm run build
npm run start
# Use PM2 or systemd to keep it running
```

---

## 🗺️ Roadmap

- [ ] Multi-branch / multi-station support
- [ ] Loyalty points & rewards
- [ ] WhatsApp order confirmation via Twilio
- [ ] PWA + offline mode for kitchen
- [ ] Aggregator (Swiggy / Zomato) API webhooks
- [ ] Analytics export to Google Sheets

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m "feat: add amazing feature"`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

**Commit convention:** [Conventional Commits](https://www.conventionalcommits.org/)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🧑‍💻 Author

**EL PRESTO PIZZA Team**
- 🌐 Website: [elpresto.in](https://elpresto.in)
- 📍 Location: UCER Campus, Naini, Prayagraj, UP 211010
- 📞 Phone: +91 6392512314
- 📷 Instagram: [@elprestopizza](https://instagram.com/elprestopizza)

> **Eat Without Guilt** 🌾 100% Whole Wheat · 0% Palm Oil · Real Mozzarella

---

## ⭐ Show Your Support

If this project helped you, give it a ⭐ on GitHub — it means a lot!

---

<p align="center">
  Made with ❤️ by the EL PRESTO team
</p>
