import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Local-testing-only override: points the app at a dev server on the same
 * network instead of the (not-yet-deployed) production URL, and allows
 * plain HTTP for that one purpose.
 *
 * NEVER ship a release build with this config -- cleartext:true disables
 * ATS/network-security protections that app store review checks for.
 *
 * Usage:
 *   1. Run `pnpm run dev` in ../ (the main app) so it's listening on :3000.
 *   2. Find your machine's LAN IP (ipconfig) -- Android emulators use the
 *      special address 10.0.2.2 to reach the host machine's localhost, a
 *      physical device needs your actual LAN IP instead.
 *   3. Copy this file over capacitor.config.ts (or pass --config to cap
 *      CLI commands) with SERVER_URL set accordingly, then `npx cap sync`.
 */
const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL ?? "http://10.0.2.2:3000";

const config: CapacitorConfig = {
  appId: "com.evidergy.carbonops",
  appName: "Evidergy CarbonOps",
  webDir: "www",
  server: {
    url: devServerUrl,
    cleartext: true,
  },
};

export default config;
