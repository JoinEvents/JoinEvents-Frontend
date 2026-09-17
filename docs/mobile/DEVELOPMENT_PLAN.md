# JoinEvents Mobile — Development Plan

**Scope:** a cross-platform mobile app for Android and iOS that mirrors the
JoinEvents web application and talks to the same backend.

**Status:** Phases 0–4 are built and in this repository under `mobile/`.
Phases 5–8 are planned and specified below.

**Last updated:** 17 September 2026

---

## 1. Decision: why Ionic Angular + Capacitor

The web app is Angular 20 with a `core/` layer of 35 services, 12 model files,
guards and HTTP interceptors — roughly 130 TypeScript files, all of it already
wired to the JoinEvents API and carrying the real business rules (cancellation
policy, escrow states, commission maths, loyalty tiers).

| Option | Reuse of `core/` | Native feel | Cost to reach parity |
|---|---|---|---|
| **Ionic Angular + Capacitor** | ~95% — services, models, guards, interceptors port with almost no change | Good: platform-adaptive components, native transitions, real plugins | **Lowest** |
| React Native / Expo | 0% — every service, model and rule rewritten in a second language runtime | Best | Highest, and the rules now live in two places that must be kept in step |
| Flutter | 0% — full rewrite in Dart | Best | Highest, plus a third language in the stack |
| PWA only | 100% | Poor | Lowest, but no push, no camera, no app stores — fails the brief |

**Chosen: Ionic Angular + Capacitor 7.**

The rationale is not "it is easier". It is that the business rules must not be
duplicated. A cancellation-fee table implemented twice will drift, and when it
drifts a customer is refunded the wrong amount. Sharing one TypeScript core
across web and mobile keeps a single source of truth for exactly the logic that
is expensive to get wrong.

**The trade-off, stated plainly:** Capacitor renders in a WebView, so this will
not match a hand-built Swift or Kotlin app on the most animation-heavy screens.
That is an acceptable price for a marketplace app, whose screens are lists,
forms and detail pages. If a screen ever genuinely needs 120fps native
rendering, Capacitor allows a native view to be embedded for that screen alone.

---

## 2. Architecture

### 2.1 Layers

```
┌─────────────────────────────────────────────────────────┐
│  Feature pages — standalone Angular components          │
│  auth · customer · vendor · admin · support · shared    │
└───────────────────────────┬─────────────────────────────┘
                            │ inject()
┌───────────────────────────▼─────────────────────────────┐
│  Core services — one per domain, extending BaseApiService│
│  auth · booking · package · messenger · rfp · payment …  │
└───────────────────────────┬─────────────────────────────┘
                            │ HttpClient
┌───────────────────────────▼─────────────────────────────┐
│  Interceptors — authInterceptor → errorInterceptor       │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  JoinEvents API (.NET, Cloud Run)  /api/v1              │
└─────────────────────────────────────────────────────────┘

Cross-cutting: StorageService (Preferences) · ThemeService ·
NetworkService · PushService · ToastService · LoggerService
```

### 2.2 State

Angular **signals** throughout, matching the web app. No NgRx: the domain is
request/response over a REST API, and a store would add indirection without
removing any real complexity. Services own their signals; pages read them.

### 2.3 Navigation

Each role gets a **tab shell** with five tabs, and deeper pages push onto the
active tab's stack so the back gesture unwinds naturally. This is the main
structural departure from the web app, which uses a persistent sidebar of
8–13 links — unusable with a thumb.

| Role | Tabs | Sidebar links folded into "More" |
|---|---|---|
| Customer | Home · Browse · Bookings · Messages · Profile | Quotes, Payments, Rewards, Saved, Support, Notifications, Settings |
| Vendor | Overview · Bookings · Packages · Leads · More | Calendar, Finance, Verification, Messages, Notifications, Settings |
| Admin | Overview · Bookings · Directory · Catalogue · More | Verifications, Disputes, Audit, Notifications, Settings |
| Support | Queue · Tickets · Verify · Bookings · More | Reviews, Directory, Notifications, Settings |

### 2.4 Design system

`src/theme/variables.css` restates the web app's `src/styles.css` custom
properties — the same `#FF6B35` primary, the same gradients, radii, type scale
and dark-mode values — and projects them onto Ionic's `--ion-*` variables so
stock Ionic components inherit the brand automatically. `src/global.css` adds
shared primitives (`.je-card`, `.je-pill--*`, `.je-stat`, `.je-action-bar`) so
individual pages carry only what is genuinely unique to them.

Dark mode is a three-way choice (light / dark / match device), persisted, and
also drives the **native status bar tint** — without that the status bar text
stays black on the dark background and becomes unreadable.

---

## 3. API integration

Every endpoint is declared in `src/app/core/constants/api.constants.ts`. No
mock data anywhere; no seeded fixtures. `BaseApiService` centralises the base
URL, parameter serialisation and the `X-Suppress-Errors` convention.

| Domain | Endpoints | Service |
|---|---|---|
| Auth | `/auth/login`, `/register`, `/social-login`, `/logout`, `/forgot-password`, `/reset-password` | `AuthService` |
| Profile | `/profile`, `/profile/password`, `/profile/avatar`, `/profile/device-token` | `ProfileService` |
| Catalogue | `/event-categories`, `/service-categories`, `/packages/search`, `/packages/:id` | `PackageService` |
| Bookings | `/bookings`, `/bookings/vendor`, `/booking`, `/bookings/:id/{status,cancel,damage,dispute,logs}` | `BookingService` |
| Quotes (RFP) | `/quotes`, `/quotes/open`, `/quotes/:id/offers`, `/offers/:id/accept`, `/rfps` | `RfpService` |
| Messaging | `/messenger/threads`, `/threads/:id/{messages,accept,reject,read,alive}`, `/messenger/request` | `MessengerService` |
| Payments | `/payment/initiate`, `/payment/confirm`, `/payment/history` | `PaymentService` |
| Loyalty | `/loyalty/{balance,history,redeem,calculate-discount,refer,review}` | `LoyaltyService` |
| Reviews | `/reviews`, `/reviews/:id/flag`, `/reviews/vendor/:id` | `ReviewService` |
| Vendor ops | `/vendor/{dashboard,analytics,calendar,verification,invoices,collaborations,enquiries,loyalty,esg-impact}` | `VendorService` |
| Vendor catalogue | `/vendor/packages` (CRUD, status, images) | `VendorPackageService` |
| Support | `/support/{stats,tickets,ticket,upload,my-tickets}`, `/tickets/:id/{reply,status}` | `SupportService` |
| Moderation | `/support/{vendors/pending,packages/pending,reviews/flagged}` and their verify/moderate actions | `SupportService` |
| Admin | `/admin/{customers,vendors,employees,audit-logs,analytics}`, `/event-categories` and `/tiers` CRUD | `AdminService` |
| Notifications | `/notifications`, `/:id/read`, `/read-all` | `NotificationService` |

**Response shape tolerance.** The API returns bare arrays in some places and
`{ data: [...] }` in others, with `id`/`packageId` and `body`/`message`/`content`
all appearing as key names. Each service normalises in one place at its
boundary, so the rest of the app sees one consistent shape.

**Failure handling.** Domain services catch their own errors and return an
empty value; the error interceptor raises a toast unless the caller opted out;
a 401 ends the session and routes to login; status `0` is reported as
"no connection", which on a phone is by far the most common cause.

---

## 4. Delivery phases

### Phase 0 — Foundation ✅ *complete*
Ionic Angular 20 + Capacitor 7 workspace; Angular build, Karma and TypeScript
configuration; design tokens and global primitives; environments for
development and production; native config for splash, push, keyboard and
status bar.

### Phase 1 — Core layer ✅ *complete*
All 12 domain models copied verbatim from the web app (identical contracts).
`StorageService` over Capacitor Preferences with a synchronous memory mirror.
`AuthService` with JWT expiry checking and role-aware routing. Auth and error
interceptors. Role guards. Platform services: theme, network, push, toast,
logger, share, favorites, location. Fifteen domain services covering the full
API surface above.

### Phase 2 — Auth and onboarding ✅ *complete*
Three-slide first-run carousel; customer sign-in with return-URL handling;
partner sign-in with an explicit role choice; registration for customer and
vendor with cross-field password validation; two-step password reset.

### Phase 3 — Customer role ✅ *complete*
Five tabs plus thirteen stacked pages: dashboard, package discovery with
filters and infinite scroll, package detail with gallery and reviews, booking
with live availability checking, checkout with reward points and coupons,
booking list and detail with timeline and cancellation preview, messaging and
chat, quote requests (list, create/edit, detail with bid comparison),
payments, rewards and referrals, saved packages, and help with tickets.

### Phase 4 — Vendor, admin and support roles ✅ *complete*
**Vendor:** dashboard, booking requests with inline accept/decline, package
management with camera-based listing, availability calendar with bulk
block/release, quote board with bidding, finance with payout breakdown, KYC
document capture, messages.
**Admin:** platform overview, booking monitor, customer and vendor directories,
catalogue configuration, audit trail.
**Support:** work queue, priority-ordered ticket inbox, ticket thread with
internal notes, vendor and package verification queue, review moderation.

### Phase 5 — Native depth *(planned — 2 weeks)*
- Firebase Cloud Messaging and APNs wired end to end, with the backend
  targeting device tokens per notification type.
- Deep links (`joinevents://` and Universal/App Links) so a push or a shared
  package URL opens the right screen from cold start.
- Biometric unlock (Face ID / fingerprint) for returning sessions.
- Offline read cache: last-loaded bookings, packages and threads served from
  storage when `NetworkService.online()` is false, with a write queue that
  flushes on reconnect.
- In-app update prompts and a forced-upgrade gate for breaking API changes.

### Phase 6 — Hardening *(planned — 2 weeks)*
- Unit coverage to 70% on `core/`, prioritising money and status transitions.
- Component tests for the booking, checkout and cancellation flows.
- End-to-end smoke suite (Appium or Maestro) over the four role journeys, run
  on one Android and one iOS device per CI run.
- Accessibility pass: minimum 44×44pt touch targets, VoiceOver and TalkBack
  labels on every icon-only control, contrast verified in both themes,
  dynamic-type support.
- Performance: bundle budget enforcement, image lazy-loading and CDN resizing,
  cold-start profiling against a 2GB Android device.
- Security: certificate pinning, jailbreak/root detection on payment screens,
  screenshot suppression on document upload, and a dependency audit.

### Phase 7 — Release *(planned — 1 week)*
- App icons and splash screens generated for every density from a single source.
- Store listings: screenshots per device class, descriptions, privacy labels
  (Apple Privacy Nutrition Label, Google Data Safety form).
- Internal testing tracks: TestFlight and Google Play internal.
- Staged rollout at 10% → 50% → 100% with crash-rate gates between stages.
- Sentry (or equivalent) for crash reporting, with source maps uploaded per build.

### Phase 8 — Post-launch *(continuous)*
- Analytics on the booking funnel: browse → detail → book → pay.
- Vendor response-time monitoring, since that is the metric most tied to
  conversion on a marketplace.
- A/B testing on discovery ranking and the onboarding carousel.
- Quarterly dependency and OS-target upgrades.

---

## 5. Risks and how they are handled

| Risk | Impact | Handling |
|---|---|---|
| API response shapes drift between web and mobile | Screens silently render empty | Normalisation confined to one method per service; contract tests planned in Phase 6 |
| Payment gateway callback is missed when the in-app browser closes | Customer paid, booking not confirmed | Confirmation is server-authoritative; the app polls booking status on return, and Payments shows the true state |
| Push tokens go stale after reinstall | Notifications stop reaching a user | Token re-registered on every launch, not only on first grant |
| Apple rejects for "web view wrapper" (guideline 4.2) | Launch delayed | The app uses camera, push, share, haptics and offline state — genuinely native capability, not a wrapped site |
| WebView performance on low-end Android | Poor reviews in the largest market segment | Lazy routes, virtualised long lists, image budget, profiled on a 2GB device in Phase 6 |
| Business rules diverge between web and mobile | Wrong refunds, wrong fees | Shared model contracts today; extracting `core/` into a workspace library is the next step (see below) |

---

## 6. Recommended next structural step

Today `mobile/src/app/core/models` is a **copy** of `src/app/core/models`. That
is fine for one release and wrong for five. The right end state is an Angular
workspace library — `libs/joinevents-core` — holding the models, API route
constants and the pure business rules (cancellation policy, commission maths,
loyalty tier thresholds), imported by both the web app and the mobile app.

That refactor is deliberately **not** bundled into this phase: it touches the
live web application, and it should land as its own reviewed change once the
mobile app's contract requirements have settled in practice.

---

## 7. Effort summary

| Phase | Status | Effort |
|---|---|---|
| 0 — Foundation | ✅ complete | — |
| 1 — Core layer | ✅ complete | — |
| 2 — Auth | ✅ complete | — |
| 3 — Customer | ✅ complete | — |
| 4 — Vendor / admin / support | ✅ complete | — |
| 5 — Native depth | planned | 2 weeks |
| 6 — Hardening | planned | 2 weeks |
| 7 — Release | planned | 1 week |
| 8 — Post-launch | continuous | — |

**Remaining to first store submission: approximately 5 weeks.**
