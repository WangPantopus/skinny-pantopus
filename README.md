# Pantopus

Pantopus is a platform for people who live in the same area to connect, trade, and manage day-to-day life around their home and neighborhood. Everything is tied to **verified addresses**, so you know who you're dealing with and can build trust with real neighbors. This repo contains the backend API, the web app, the native iOS app (Swift / SwiftUI), and the native Android app (Kotlin / Jetpack Compose), plus shared packages used by the web app.

## What the app does

- **Verified addresses** — Each home has a persistent digital identity. Users link to an address (verified by landlord/escrow or mail), which underpins trust and reduces fraud in the neighborhood.
- **Gig marketplace** — Post and complete local tasks, get matched by skills, pay and get paid via Stripe Connect, with ratings and reviews.
- **Digital mailbox** — Receive mail at your verified address; ad-supported delivery lets users earn per ad view and cuts down physical junk mail.
- **Neighborhood social** — Feeds and post types for selling, hiring, sharing, and more, with verified identity so interactions feel safer.
- **Home management** — Shared household info, maintenance logs, guest Wi‑Fi, family calendar.
- **Real-time chat** — Direct and group messaging, gig coordination, typing indicators and read receipts (Socket.IO).
- **Business & trust** — Business profiles, verification, discovery, public pages, wallet, trust graph, professional mode, hub, and listings.
- **AI & automation** — In-app AI agent (chat, drafts, place brief) and Magic Task for AI-assisted task posting.

The app is available as a **web app** (Next.js), a **native iOS app** (Swift / SwiftUI), and a **native Android app** (Kotlin / Jetpack Compose), all backed by a shared REST + Socket.IO API.

---

## Table of Contents

- [What the app does](#what-the-app-does)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Applications](#applications)
- [Development commands](#development-commands)
- [Tech stack](#tech-stack)
- [Shared packages](#shared-packages)
- [API overview](#api-overview)
- [Testing](#testing)
- [Deployment](#deployment)
- [Migration notes (from React Native)](#migration-notes-from-react-native)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License & links](#license--links)
- [Important notes](#important-notes)

---

## Project Structure

This is a **pnpm + Turborepo** monorepo for the JS/TS side, plus two independent native app projects (iOS with **XcodeGen**, Android with **Gradle Kotlin DSL**) that live alongside the web app.

```
pantopus/
├── backend/                      # Express.js API server
│   ├── routes/                   # API endpoints (users, gigs, chats, mailbox, etc.)
│   ├── services/                 # Business logic (Stripe, AI, mail, push, etc.)
│   ├── middleware/               # Auth, validation, rate limiting, APM
│   ├── config/                   # Supabase, env
│   ├── socket/                   # Socket.IO (chat)
│   ├── jobs/                     # Background cron jobs
│   ├── stripe/                   # Stripe webhooks
│   ├── app.js                    # Entry point
│   └── package.json
│
├── frontend/
│   ├── apps/
│   │   ├── web/                  # Next.js web app
│   │   │   ├── src/app/          # App Router (Next.js 15)
│   │   │   └── package.json
│   │   │
│   │   ├── ios/                  # Native iOS app (Swift, SwiftUI, iOS 17+)
│   │   │   ├── project.yml       # XcodeGen project config
│   │   │   ├── Pantopus/         # App source
│   │   │   ├── PantopusTests/    # Unit tests
│   │   │   ├── PantopusUITests/  # UI tests
│   │   │   ├── fastlane/         # CI/CD lanes
│   │   │   └── Makefile
│   │   │
│   │   └── android/              # Native Android app (Kotlin, Jetpack Compose)
│   │       ├── settings.gradle.kts
│   │       ├── build.gradle.kts
│   │       ├── gradle/
│   │       │   └── libs.versions.toml  # Version catalog
│   │       ├── app/
│   │       │   ├── build.gradle.kts
│   │       │   └── src/main/java/app/pantopus/android/
│   │       └── gradlew
│   │
│   └── packages/                 # Shared TypeScript code (used by web)
│       ├── api/                  # API client (auth, requests, errors)
│       ├── theme/                # Theming
│       ├── types/                # TypeScript types
│       ├── ui-utils/             # UI utilities
│       └── utils/                # Validation, formatters, constants
│
├── docs/                         # Design docs, runbooks, plans
├── supabase/                     # Supabase config and migrations
├── pantopus-seeder/              # Python seeder service
├── package.json                  # Root workspace config (JS/TS only)
├── turbo.json                    # Turborepo tasks
└── pnpm-workspace.yaml
```

**Why two native apps instead of React Native?** Each platform gets first-class access to its native SDKs, idiomatic UI (SwiftUI / Jetpack Compose), and tuned performance — without the RN bridge, Metro, or Expo build pipeline. Trade-off: no shared client code between iOS and Android; the REST + Socket.IO API is the shared contract.

---

## Prerequisites

### Web + Backend
- **Node.js** 18+
- **pnpm** (do not use `npm install` in the repo)
- **PostgreSQL** via Supabase

### iOS
- **macOS** (required for Xcode)
- **Xcode** 15.4+ (Swift 5.10, iOS 17 SDK)
- **Homebrew**
- **XcodeGen** (`brew install xcodegen`)
- **SwiftLint** (`brew install swiftlint`) — optional but recommended
- **SwiftFormat** (`brew install swiftformat`) — optional but recommended
- **Fastlane** (`brew install fastlane`) — for CI/CD

### Android
- **JDK 17** (Temurin recommended — `brew install --cask temurin@17` on macOS)
- **Android Studio** Hedgehog (2023.1.1) or later, with Android SDK 34
- Gradle is provided via the wrapper (`./gradlew`) — no global install needed

---

## Installation

1. **Install pnpm** (if needed):

   ```bash
   npm install -g pnpm
   ```

2. **Install JS/TS dependencies** (backend, web, shared packages):

   ```bash
   pnpm install
   ```

3. **Set up environment variables:**

   | App     | Copy from                                           | To                                      |
   |---------|-----------------------------------------------------|-----------------------------------------|
   | Backend | `backend/.env.example`                              | `backend/.env`                          |
   | Web     | `frontend/apps/web/.env.local.example`              | `frontend/apps/web/.env.local`          |
   | iOS     | `frontend/apps/ios/.env.example`                    | `frontend/apps/ios/.env`                |
   | Android | `frontend/apps/android/.env.example`                | `frontend/apps/android/.env`            |

4. **Bootstrap iOS** (macOS only):

   ```bash
   cd frontend/apps/ios
   make bootstrap   # runs xcodegen, resolves SPM deps
   make open        # opens Pantopus.xcodeproj in Xcode
   ```

5. **Bootstrap Android**:

   ```bash
   cd frontend/apps/android
   ./gradlew --version       # triggers wrapper download
   ./gradlew assembleDebug   # first build
   ```

   Or just open `frontend/apps/android/` in Android Studio and let it sync.

---

## Quick Start

**Option A – Run everything with Turbo (backend + web):**

```bash
pnpm dev
```

**Option B – Run each piece in its own terminal:**

```bash
# Terminal 1: Backend (port 8000)
pnpm dev:backend

# Terminal 2: Web (port 3000)
pnpm dev:web

# Terminal 3: iOS (opens Xcode, then ⌘R)
pnpm ios:open

# Terminal 4: Android (or use Android Studio)
pnpm android:install:debug
```

- **Web:** http://localhost:3000
- **API:** http://localhost:8000
- **API docs:** http://localhost:8000/api-docs

> **Note on device/simulator networking:** Android emulators reach the host via `http://10.0.2.2:8000`. iOS simulators can use `http://localhost:8000`. A physical device needs your machine's LAN IP. The `.env.example` files explain this per platform.

---

## Applications

| App       | Platform              | Stack                                                          |
|-----------|-----------------------|----------------------------------------------------------------|
| **Web**   | http://localhost:3000 | Next.js 15 (App Router), React 19, Tailwind CSS                |
| **iOS**   | iOS 17+               | Swift 5.10, SwiftUI, `@Observable`, async/await, SwiftPM       |
| **Android** | Android 8.0+ (API 26+) | Kotlin 2.0, Jetpack Compose, Material 3, Hilt, Coroutines/Flow |
| **Backend** | http://localhost:8000 | Express 5, PostgreSQL (Supabase), Socket.IO                    |

---

## Development Commands

### Root (Turborepo)

| Command        | Description                                 |
|----------------|---------------------------------------------|
| `pnpm dev`     | Run backend + web in dev mode               |
| `pnpm build`   | Build backend + web                         |
| `pnpm lint`    | Lint all JS/TS workspaces                   |
| `pnpm clean`   | Clean build artifacts + root `node_modules` |
| `pnpm format`  | Format with Prettier                        |

### Per-app

| Target  | Command                                                   |
|---------|-----------------------------------------------------------|
| Backend | `pnpm dev:backend`; tests: `cd backend && pnpm test`      |
| Web     | `pnpm dev:web`; build: `pnpm build:web`                   |
| iOS     | `pnpm ios:open` (opens Xcode); `make build`, `make test` from `frontend/apps/ios` |
| Android | `pnpm android:assemble:debug`; tests: `./gradlew test` from `frontend/apps/android` |

Native-project-specific commands (lint, format, release builds, store submission) live in each app's own README: `frontend/apps/ios/README.md` and `frontend/apps/android/README.md`.

---

## Tech Stack

| Layer       | Technologies                                                                                        |
|-------------|-----------------------------------------------------------------------------------------------------|
| **Web**     | Next.js 15, React 19, Tailwind CSS, TypeScript, TanStack Query, Socket.IO client, Stripe.js, Leaflet |
| **iOS**     | Swift 5.10, SwiftUI, Observation, URLSession + async/await, Stripe iOS SDK, Socket.IO-Client-Swift, MapKit, KeychainAccess, swift-log |
| **Android** | Kotlin 2.0, Jetpack Compose, Material 3, Hilt, Retrofit + OkHttp + Moshi, Kotlinx Coroutines/Flow, Navigation Compose, DataStore, Coil, Stripe Android SDK, Google Maps Compose, Socket.IO Java client |
| **Backend** | Express 5, Node 18+, PostgreSQL (Supabase + PostGIS), Socket.IO, Supabase Auth, Stripe Connect, Twilio, OpenAI, Winston, Helmet |
| **Infra**   | Turborepo, pnpm workspaces, GitHub Actions, Docker (backend), Vercel (web), Fastlane (iOS), Play Publishing (Android), EC2 (backend hosting) |

---

## Shared Packages

These TypeScript packages are consumed by the **web app** and the **backend**. The native iOS and Android apps talk to the backend directly over REST + Socket.IO — they do not consume these packages. Shared contracts between web and native clients are the REST schemas + OpenAPI docs served at `/api-docs`.

| Package              | Purpose                                                               |
|----------------------|-----------------------------------------------------------------------|
| `@pantopus/api`      | API client: auth, request/response handling, errors (web only).       |
| `@pantopus/theme`    | Shared theming for web.                                               |
| `@pantopus/types`    | TypeScript types (web + backend).                                     |
| `@pantopus/ui-utils` | UI helpers for web.                                                   |
| `@pantopus/utils`    | Validation, formatters, constants, helpers.                           |

---

## API Overview

The backend exposes REST routes and Socket.IO for chat. Main route areas (see `backend/routes/` and `backend/app.js`):

- **Auth & users:** `users`, `privacy`, `blocks`
- **Homes & addresses:** `home`, `homeIam`, `homeOwnership`, `landlordTenant`, `homeGuest`, `addressValidation`, `geo`, `location`, `savedPlaces`
- **Content & social:** `posts`, `gigs`, `gigsV2`, `offers`, `offersV2`, `reviews`, `listings`
- **Mailbox:** `mailbox`, `mailboxV2`, `mailboxV2Phase2`, `mailboxV2Phase3`, `lobWebhook`
- **Chat:** `chats` + Socket.IO
- **Payments & wallet:** `pays`, `wallet`, Stripe webhooks
- **Business:** `businesses`, `businessIam`, `businessSeats`, `businessVerification`, `businessFounding`, `businessDiscovery`, `businessPublicPage`
- **AI & tasks:** `ai`, `magicTask`
- **Other:** `files`, `upload`, `notifications`, `relationships`, `professional`, `hub`, `internal`, `admin`, `debug`

---

## Testing

```bash
# All JS/TS workspaces (where defined)
pnpm test

# Backend only
cd backend && pnpm test

# Web only
cd frontend/apps/web && pnpm test

# Backend integration
cd backend && pnpm test:integration

# iOS
cd frontend/apps/ios && make test

# Android
cd frontend/apps/android && ./gradlew test
```

---

## Deployment

### Backend (EC2 + Docker)

- **Workflow:** `.github/workflows/deploy-backend.yml`
- **Triggers:** Push to `dev` → staging EC2; push to `main` → production EC2.
- **Secrets:** `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `EC2_SSH_KEY`, `EC2_USERNAME`, `STAGING_EC2_HOST`, `PROD_EC2_HOST`

### Web (Vercel)

- **Method:** Vercel Git integration.
- **Settings:** Root Directory = `frontend/apps/web`, Framework = Next.js, Production branch = `main`, Preview = `dev`.
- **Env:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

### iOS (App Store Connect via Fastlane)

```bash
cd frontend/apps/ios
bundle install           # first time only
bundle exec fastlane beta        # TestFlight
bundle exec fastlane release     # App Store
```

See `frontend/apps/ios/README.md` and `frontend/apps/ios/fastlane/Fastfile` for the full lane setup (signing, provisioning, screenshots).

### Android (Play Store via Gradle Play Publisher)

```bash
cd frontend/apps/android
./gradlew bundleRelease                  # AAB
./gradlew publishReleaseBundle           # Requires Play service account JSON
```

See `frontend/apps/android/README.md` for signing config and Play Console setup.

### Rollback

- **Backend:** Run `.github/workflows/rollback-backend.yml`; choose `target` (`staging` or `production`) and `image_tag`.
- **Web:** Use Vercel dashboard or CLI to redeploy a previous deployment.
- **iOS:** Submit a new build to App Store Connect with the previous version's code.
- **Android:** Use Play Console's release rollback or roll out a previous AAB.

---

## Migration notes (from React Native)

This monorepo previously had a React Native / Expo app at `frontend/apps/mobile/`. It was replaced by the two native projects described above. A few things you should know when picking this up:

- **Push notifications:** the backend's `backend/services/pushService.js` still uses `expo-server-sdk` because the old Expo app relied on Expo's push infrastructure (which in turn forwards to APNs / FCM). For the native apps, you'll want to migrate this service to use **APNs directly** (e.g. the [`apn`](https://www.npmjs.com/package/apn) or `@parse/node-apn` package, or HTTP/2 directly) for iOS and **FCM** (via `firebase-admin`) for Android. The device-token storage schema will also need an additional `platform` column (`ios` / `android`) and the token column is no longer an Expo push token. Tracking issue: `docs/push-native-migration.md` (to be written).
- **Shared TS packages:** the native apps do not consume `@pantopus/api`, `@pantopus/types`, etc. Contracts are defined by the REST API. If you change a backend type, you need to manually reflect it in `frontend/apps/ios/Pantopus/Core/Networking/Models/` and `frontend/apps/android/app/src/main/java/app/pantopus/android/data/api/models/`. Consider generating these from the backend's OpenAPI spec (there's a tool stub noted in each app's README).
- **Feature parity:** The native apps ship with skeletons for auth, home/feed, and a wired-up API + Socket.IO client. Feature screens from the old mobile app (gigs, mailbox, chat, etc.) need to be re-implemented per platform. Use the existing backend routes and the web app at `frontend/apps/web/` as reference for UX and data flow.
- **EAS / app.json / Metro / Babel:** all gone. Don't re-introduce them.

---

## Documentation

Design docs live in **`docs/`**. Some are historical (written when the mobile app was React Native) but the backend-, feature-, and domain-level content is still accurate. Worth reading:

- `00-architecture-overview.md`, `01-authentication-authorization.md`, `02-api-routes-and-services.md`
- `03-jobs-stripe-realtime.md`, `04-lambda-functions-seeder.md`
- `06-frontend-web-app.md`
- Auth/authz and payment/payout audits, marketplace production readiness
- Geo: feature flags, rollout, monitoring, runbooks, maps migration
- Message/chat plan, relationship/identity execution plan

---

## Contributing

This is a solo founder project (YP). For major changes, open an issue first.

---

## License & Links

- **License:** ISC — Copyright (c) 2026 Pantopus Platform
- **API docs (local):** http://localhost:8000/api-docs

---

## Important Notes

- **Use pnpm only** for JS/TS. Do not run `npm install` in the repo.
- **iOS and Android are NOT pnpm workspaces.** They're managed by XcodeGen/SwiftPM and Gradle respectively. Don't add `package.json` to `frontend/apps/ios/` or `frontend/apps/android/`.
- **Don't commit build artifacts:** `DerivedData/`, `build/`, `.gradle/`, `*.xcodeproj/` (generated), `.idea/` are all in `.gitignore`.

---

*Built with care by Yingpeng — transforming neighborhoods, one address at a time.*
