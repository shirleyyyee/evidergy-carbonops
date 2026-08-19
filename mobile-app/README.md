# Evidergy CarbonOps — mobile app shell

A [Capacitor](https://capacitorjs.com/) native wrapper around the existing web product
(`../app`). It runs in **server mode** — the native shell loads a live URL rather than
bundling a static export — because the product is dynamic (server-rendered pages,
cookie-based auth, API routes), not a static site that could be exported and embedded.

This is a scaffold for you to build and submit yourself, not a finished submission.
Nothing here has been built, run, or uploaded — this machine has no Android SDK, no
Xcode, and no App Store / Play Console accounts. What's below is exactly what exists,
what's a placeholder, and what you still need to do.

## What's already done

- `capacitor.config.ts` — Capacitor project config
- `android/` — real native Android Studio project (`npx cap doctor` confirms it's
  structurally valid)
- `ios/` — real native Xcode project (uses Swift Package Manager, not CocoaPods, so
  it doesn't need Ruby/CocoaPods to scaffold — but building it still requires Xcode
  on a Mac, which this machine doesn't have)
- App icon and splash screen generated for both platforms (and a bonus PWA icon set)
  from `../public/evidergy-logo.png` via `@capacitor/assets`

## What's a placeholder — must change before real submission

| Item | Current placeholder | Why it matters |
|---|---|---|
| `appId` (`com.evidergy.carbonops`) in `capacitor.config.ts` | Reasonable guess, not registered anywhere | This is the app's permanent bundle identifier in both stores. It must match what you register in App Store Connect / Google Play Console, and **cannot be changed after first submission** without shipping as a new, separate app listing. |
| `server.url` (`https://REPLACE-WITH-DEPLOYED-URL.example.com`) | Not a real address | See "The real blocker" below — there is no public deployment of this app yet. |
| App icon source | Reused `evidergy-logo.png` as-is | Works fine as a placeholder; a real store listing usually wants a purpose-cropped icon (no transparency issues, safe-zone padding) rather than the raw logo. |
| Signing keys (Android keystore, iOS certificates/provisioning profiles) | Don't exist yet | Generated during the build step on your own machine/account — see below. `.gitignore` already excludes common keystore/cert file patterns so these never get committed by accident. |

## The real blocker: there's no production deployment yet

The main app (`../`) currently only runs via `pnpm run dev` on localhost. The only
thing publicly deployed is the static GitHub Pages technical-validation record
(`docs/site/`) — a completely different, read-only summary page, not the actual
interactive product.

A native app in server mode needs a real, public, HTTPS URL to point at. Before you
can build a release artifact for either store, the main app needs an actual
deployment (this project targets Cloudflare Workers — see `../package.json` and the
`vinext`/Cloudflare setup already in `../`). That's a separate task from anything in
this folder and needs its own decision about hosting, secrets (`ANTHROPIC_API_KEY`,
etc.), and a database. Ask me when you're ready to do that piece.

## Testing locally right now (no deployment needed)

You can point the native shell at your own dev server on the same machine/network:

1. In `../` run `pnpm run dev` so the app is listening on `:3000`.
2. Use `capacitor.config.dev.ts` instead of the default config — it points at
   `http://10.0.2.2:3000` (the special address an Android emulator uses to reach
   the host machine) and allows plain HTTP for local testing only. Set
   `CAPACITOR_DEV_SERVER_URL` if testing on a physical device on your LAN instead.
3. **Never ship a release build with the dev config** — `cleartext: true` disables
   protections app store review checks for.

## Android — what you need to do

1. Install [Android Studio](https://developer.android.com/studio) (includes the SDK).
2. Open the `mobile-app/android/` folder in Android Studio directly.
3. Let it sync, then Run on an emulator or a USB-connected device to see it live.
4. Create a [Google Play Console](https://play.google.com/console/) account
   (one-time ~US$25 registration fee).
5. Build → Generate Signed App Bundle in Android Studio. It'll walk you through
   creating a release keystore — **back this up somewhere safe outside of git**;
   losing it means you can never update the app again under the same listing.
6. Upload the `.aab` to Play Console, fill in the store listing (screenshots,
   description, privacy policy URL, content rating questionnaire), submit for review.
   Review is typically hours to a few days.

## iOS — what you need to do

**Requires a Mac.** There is no way around this — Xcode only runs on macOS, and
Apple requires it for both building and App Store submission. Nothing about this
is a Capacitor limitation; it's an Apple platform requirement.

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/)
   (US$99/year).
2. Copy this whole `mobile-app/` folder to a Mac, run `npm install`, then open
   `ios/App/App.xcodeproj` in Xcode.
3. In Xcode: set your Team (from your Developer Program account) under Signing &
   Capabilities — it will generate certificates/provisioning profiles for you.
4. Run on the iOS Simulator (no device needed) or a connected iPhone to test.
5. Product → Archive, then use the Organizer window to upload to App Store Connect.
6. In App Store Connect: create the app listing (screenshots, description, privacy
   policy URL, age rating), submit the build for review. Review is typically
   1–3 days, occasionally longer.

## Command reference

```bash
cd mobile-app
npx cap sync            # re-copy web assets + config into both native projects
npx cap sync android     # Android only
npx cap sync ios         # iOS only
npx cap doctor          # sanity-check the whole setup
npx capacitor-assets generate   # regenerate icons/splash if the source logo changes
```

Run `npx cap sync` any time you change `capacitor.config.ts` or install a Capacitor
plugin — it's how config and web assets get pushed into the native projects.
