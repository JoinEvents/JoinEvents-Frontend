# JoinEvents Mobile

The JoinEvents marketplace as a native app for **Android and iOS**, built from one
codebase with **Ionic Angular 8 + Angular 20 + Capacitor 7**.

It mirrors the Angular web application in `../src` — same four roles, same
journeys, same backend — reshaped for a phone and extended with the things only
a native app can do: push notifications, the camera, the share sheet, haptics
and offline awareness.

---

## Quick start

```bash
cd mobile
npm install

# Browser preview (fastest loop; native plugins degrade gracefully)
npm start                 # http://localhost:4200

# Native builds
npx cap add android       # once
npx cap add ios           # once, macOS only
npm run android           # build → sync → open Android Studio
npm run ios               # build → sync → open Xcode
```

`npm run sync` rebuilds the web bundle and copies it into both native projects.
Run it after any change before testing on a device.

### Tests

```bash
CHROME_BIN=$(which chromium) npm test -- --watch=false
```

---

## Where things live

```
mobile/
├── capacitor.config.ts          App id, splash, push and keyboard config
├── src/
│   ├── main.ts                  Bootstrap: router, HTTP interceptors, Ionic
│   ├── global.css               Shared primitives (.je-card, .je-pill, …)
│   ├── theme/variables.css      Design tokens, mirrored from the web app
│   ├── environments/            API base URL per build configuration
│   └── app/
│       ├── app.component.ts     Shell: storage hydration, session restore,
│       │                        theme, network, push, Android back button
│       ├── app.routes.ts        Role-partitioned route tree
│       ├── core/
│       │   ├── constants/       API_ROUTES — every backend endpoint
│       │   ├── models/          Copied verbatim from the web app
│       │   ├── services/        Auth, storage, and one service per domain
│       │   ├── interceptors/    Bearer token, central error handling
│       │   ├── guards/          Role guards
│       │   └── handlers/        Global error handler
│       ├── shared/              Reusable components and pipes
│       └── features/
│           ├── auth/            Onboarding, sign-in, register, reset
│           ├── customer/        5 tabs + 13 stacked pages
│           ├── vendor/          5 tabs + 7 stacked pages
│           ├── admin/           5 tabs + audit
│           ├── support/         5 tabs + ticket detail, moderation
│           └── shared/          Notifications, settings, 404
```

## Backend

Every screen talks to the same JoinEvents API the web app uses. There is no
mock layer and no seeded data — `src/environments/environment.ts` points at
production and `environment.development.ts` at a local server.

On the **Android emulator** `localhost` is the emulator itself, so the
development environment uses `10.0.2.2`, its alias for the host machine. On an
**iOS simulator** `localhost` resolves to the host directly. On a **physical
device** change it to your machine's LAN IP.

## Native configuration

`npx cap add` generates `android/` and `ios/`; both are gitignored because they
are reproducible. After generating them, apply these once:

**`android/app/src/main/AndroidManifest.xml`**

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Drop the Firebase `google-services.json` into `android/app/` for push.

**`ios/App/App/Info.plist`**

```xml
<key>NSCameraUsageDescription</key>
<string>Photograph your venue and documents to list packages and verify your business.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Choose photos for your packages and profile.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Save invoices and booking confirmations to your photos.</string>
```

Enable Push Notifications and Background Modes → Remote notifications in the
Xcode target's Signing & Capabilities tab, and upload the APNs key to Firebase.

## Conventions worth knowing

- **Storage is async, reads are sync.** `StorageService` hydrates a memory
  mirror from Capacitor Preferences once at startup, before the first route
  resolves, so guards and interceptors read the session synchronously exactly
  as they do on the web.
- **Every service degrades.** Domain services catch their own failures and
  return an empty value, so one broken endpoint cannot blank a whole screen.
- **`X-Suppress-Errors`** on a request means "I will render this failure
  myself" — the error interceptor stays quiet for it.
- **Tabs refresh on `ionViewWillEnter`,** not `ngOnInit`: Ionic keeps tab pages
  alive, so `ngOnInit` fires only once per session.
- **Polling is scoped to the visible page.** The chat screen starts its poll in
  `ionViewWillEnter` and tears it down in `ionViewWillLeave`.
