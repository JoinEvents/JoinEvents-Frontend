# JoinEvents Mobile — Build Report

**Deliverable:** a cross-platform mobile application for Android and iOS that
mirrors the JoinEvents web app and integrates with the live JoinEvents backend.

**Location:** `mobile/` in this repository.
**Branch:** `claude/cross-platform-mobile-app-yqkg16`
**Date:** 17 September 2026

---

## 1. What was built

A complete Ionic Angular + Capacitor application covering **all four roles** of
the web product, wired end to end to the production API. No mock data, no
placeholder screens, no seeded fixtures — every screen reads from and writes to
the same `.NET` backend the web app uses.

| | Count |
|---|---|
| TypeScript files | 113 |
| Feature pages | 51 |
| Core services | 25 |
| Domain models | 12 (identical contracts to the web app) |
| Shared components | 4 |
| Shared pipes | 4 |
| Lines of source (ts + css + html) | ~13,900 |
| Unit tests | 16, all passing |

**Build status**

```
npx ng build --configuration production   → success, 0 errors, 0 warnings
npx ng test --watch=false                 → 16 of 16 SUCCESS
```

---

## 2. Technology choice

**Ionic Angular 8 + Angular 20 + Capacitor 7.**

The existing web app carries the business rules that are expensive to get wrong
— the cancellation-fee schedule, escrow and booking state transitions,
commission and TDS maths, loyalty tier thresholds — inside an Angular `core/`
layer. React Native or Flutter would have meant reimplementing all of it in a
second language. Two implementations of a refund table drift, and when they
drift someone is refunded the wrong amount.

Ionic keeps one TypeScript core across both platforms while still producing a
real native binary with real native capability.

**The trade-off, stated plainly:** Capacitor renders in a WebView, so this will
not match hand-written Swift or Kotlin on animation-heavy screens. For a
marketplace of lists, forms and detail pages that is an acceptable cost, and
Capacitor leaves the door open to embedding a native view for any single screen
that later needs one.

The full comparison is in [`DEVELOPMENT_PLAN.md §1`](./DEVELOPMENT_PLAN.md).

---

## 3. Feature coverage against the web app

### Customer — 18 pages
Onboarding carousel · sign-in · registration · password reset · dashboard with
next-event card and quick actions · package discovery with category chips,
search, a filter sheet and infinite scroll · package detail with swipeable
gallery, inclusions, policies and reviews · booking form with **live vendor
availability checking** and a running price breakdown · checkout with reward
points, coupons and hosted-gateway handoff · booking list filtered by
upcoming/past/cancelled · booking detail with a status timeline, itemised
money, review submission, **refund preview before cancelling**, and dispute
raising · conversation list with chat requests · chat with polling and date
separators · quote requests: list, create/edit, and detail with bids ranked
for comparison · payments and invoices · rewards, tier progress and referrals ·
saved packages with swipe-to-remove · help centre with FAQs and tickets ·
notifications · settings.

### Vendor — 11 pages
Dashboard with monthly revenue, verification nudge and profile completion ·
booking requests with **inline accept and decline** · package list with
activate/deactivate toggles and swipe-to-delete · package editor that
**photographs listings with the device camera** · availability calendar with
multi-select bulk block and release · quote board with bid submission ·
invoices and payouts showing platform fee and TDS per invoice · KYC document
capture · messages with chat-request handling · notifications · settings.

### Admin — 7 pages
Platform overview (GMV, revenue, counts, decision queues) · booking monitor
with search, filters and agent actions · customer and vendor directories with
server-side search · catalogue configuration (categories and tiers, full CRUD) ·
audit trail with filtering · notifications · settings.

### Support — 7 pages
Work queue with live counts · ticket inbox **ordered by priority then age** so
nothing urgent sinks · ticket thread with triage controls and visually distinct
internal notes · vendor and package verification queue with approve/reject and
document viewing · flagged review moderation · directory lookup · settings.

### Deliberate departures from the web app

These are not gaps — they are changes made because a phone is not a browser:

1. **Sidebar → tab shells.** The web app uses a persistent sidebar of 8–13
   links per role. That is unusable with a thumb. Each role now has five tabs
   carrying its daily jobs, with the rest behind "More".
2. **Pagination → infinite scroll.** Numbered page controls are awkward to tap.
3. **Inline toasts → native toasts, sheets and haptics.** Confirmations use the
   platform's own alert, action-sheet and haptic feedback.
4. **Modals → bottom sheets** with drag breakpoints, the native idiom.
5. **Delete buttons → swipe actions** on list rows.
6. **Payment iframe → in-app browser tab.** A payment page must never run
   inside the app's own WebView: the user cannot see the real URL or
   certificate there, and card autofill will not offer to fill it. Using
   SFSafariViewController / Custom Tabs also keeps the app out of PCI scope.

---

## 4. API integration

Every endpoint the web app uses is declared in
`mobile/src/app/core/constants/api.constants.ts` and consumed through a service.
Coverage by domain: auth, profile, catalogue, bookings, quotes, messaging,
payments, loyalty, reviews, vendor operations, vendor catalogue, support,
moderation, admin and notifications. The full endpoint table is in
[`DEVELOPMENT_PLAN.md §3`](./DEVELOPMENT_PLAN.md).

Three things were needed to make this reliable against the live API:

**Shape tolerance.** The backend returns bare arrays in some places and
`{ data: [...] }` in others, and uses `id`/`packageId`, `body`/`message`/`content`
interchangeably. Each service normalises once at its own boundary so the rest
of the app sees one consistent shape.

**Graceful degradation.** Domain services catch their own failures and return
an empty value. The customer dashboard, for example, fans out four calls in
parallel and joins them — one slow or broken endpoint cannot blank the screen.

**Central failure handling.** `errorInterceptor` ends the session on 401,
reports status `0` as "no connection" rather than a server error (on a phone
that is almost always the real cause), and stays silent for callers that pass
`X-Suppress-Errors` because they render the failure inline.

---

## 5. Mobile-specific engineering

Points where the mobile app genuinely differs from a ported web page:

**Storage.** The web app reads `localStorage` synchronously. On a device that
is the wrong primitive — a WebView's `localStorage` can be evicted under storage
pressure and is invisible to native code. `StorageService` uses Capacitor
Preferences (SharedPreferences on Android, NSUserDefaults on iOS) and hydrates
a synchronous memory mirror once at startup, before the first route resolves,
so guards and interceptors still read the session synchronously.

**Android hardware back button.** It has no browser equivalent. Without a
listener it does nothing on a root tab; now it exits the app, which is what
Android users expect.

**Status bar tinting.** Dark mode also sets the native status bar style.
Without it the status bar text stays black on the dark background and becomes
unreadable.

**Scoped polling.** Chat polls only while its page is on screen — started in
`ionViewWillEnter`, torn down in `ionViewWillLeave`. Polling a backgrounded
screen is a battery cost with no benefit.

**Tab lifecycle.** Ionic keeps tab pages alive, so `ngOnInit` fires once per
session. Every tab refreshes on `ionViewWillEnter` instead, or it would show
stale data indefinitely.

**Camera over file pickers.** Package photos and KYC documents are captured
with the device camera. A vendor with a paper GST certificate can complete
verification without a scanner, and can photograph a venue and list it without
touching a desktop. Photos come back as base64 rather than file URIs so one
code path works on both platforms — iOS returns a `file://` URI the WebView
cannot read without a permission dance, and Android's content URI needs
resolving.

**Local-date keys in the calendar.** `toISOString()` shifts the day for
timezones behind UTC, which would have blocked the wrong date for a vendor in
the Americas. The calendar builds its keys from local date parts.

**Phone masking.** Support and admin screens list customer and vendor numbers.
They are masked to the last four digits by default — an agent rarely needs the
full number to resolve a ticket, and an unmasked one on screen can be
shoulder-surfed.

**Offline awareness.** `NetworkService` tracks connectivity and a persistent
banner tells the user when what they are looking at is the last loaded data.

---

## 6. Testing

16 unit tests, all passing, focused on the logic where a bug costs money or
locks someone out:

- **`BookingService.previewCancellation`** — 6 tests over the full fee
  schedule: free at 30+ days, 25% at 15–29, 50% at 7–14, non-refundable inside
  7, correct handling when the balance is already settled, and vendor-side
  cancellation (customer made whole, vendor penalised).
- **`authGuard` / `guestGuard`** — 6 tests: anonymous visitors redirected with
  their destination preserved, single-role and multi-role admission,
  cross-role access denied and routed to the user's own home, and signed-in
  users kept out of the auth screens.
- **`CurrencyInrPipe`** — 4 tests: lakh/crore grouping (`₹12,50,000`, not
  `₹1,250,000`), null safety, and K/L/Cr abbreviation.

Run with:

```bash
cd mobile && CHROME_BIN=$(which chromium) npm test -- --watch=false
```

Broader coverage — component tests for the booking and checkout flows, an
end-to-end smoke suite across the four roles, and an accessibility pass — is
Phase 6 of the plan.

---

## 7. How to run it

```bash
cd mobile
npm install

npm start                 # browser preview at http://localhost:4200

npx cap add android       # once
npx cap add ios           # once, macOS only
npm run android           # build → sync → open Android Studio
npm run ios               # build → sync → open Xcode
```

`android/` and `ios/` are gitignored because `npx cap add` regenerates them.
The permissions and Info.plist keys to apply after generating them are listed
in [`mobile/README.md`](../../mobile/README.md).

The development environment points at `http://10.0.2.2:7010/api/v1` — the
Android emulator's alias for the host machine. On an iOS simulator `localhost`
works directly; on a physical device, use your machine's LAN IP.

---

## 8. What is not done

Stated plainly, so nothing here reads as further along than it is:

- **Native platform folders are not committed.** `npx cap add android` and
  `npx cap add ios` generate them; they are reproducible build output, not
  source. Firebase config files and signing certificates are the operator's to
  supply.
- **Push is wired in the app but not end to end.** `PushService` requests
  permission, registers the device token against the account and routes taps
  to deep links. The backend still needs to target those tokens, and Firebase
  and APNs credentials need installing. This is the first item of Phase 5.
- **Deep links are not registered.** Push taps route correctly in-app, but
  `joinevents://` and Universal/App Links are not yet declared in the native
  manifests, so a cold-start open from a shared URL does not land on the right
  screen yet.
- **No offline write queue.** The app reads and reports connectivity; it does
  not yet queue mutations made while offline.
- **Social sign-in is stubbed.** `AuthService.socialLogin` calls the endpoint,
  but the Google and Facebook SDKs are not integrated, so the button reports
  that it is coming soon rather than pretending to work.
- **Test coverage is targeted, not broad.** 16 tests over the money and access
  logic. Phase 6 raises this.
- **`mobile/src/app/core/models` is a copy of the web app's models,** not a
  shared library. That is fine for one release and wrong for five — the models
  will drift. The right fix is a workspace library imported by both apps, and
  §6 of the plan explains why that refactor is deliberately held back rather
  than bundled in here: it touches the live web application and deserves its
  own reviewed change.

Remaining effort to first store submission: **approximately 5 weeks** across
Phases 5–7.

---

## 9. Files added

```
docs/mobile/DEVELOPMENT_PLAN.md    This project's full plan, phases 0–8
docs/mobile/MOBILE_REPORT.md       This report
mobile/                            The application
├── README.md                      Setup, conventions, native configuration
├── package.json                   Scripts for build, sync, android, ios, test
├── capacitor.config.ts            App id, splash, push, keyboard
├── angular.json, tsconfig*.json, karma.conf.js
└── src/
    ├── theme/variables.css        Design tokens mirrored from the web app
    ├── global.css                 Shared style primitives
    ├── environments/              Production and development API targets
    └── app/
        ├── core/                  Models, services, interceptors, guards
        ├── shared/                Components and pipes
        └── features/              auth · customer · vendor · admin · support
```
