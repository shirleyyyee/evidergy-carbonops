import type { CapacitorConfig } from "@capacitor/cli";

/**
 * This wraps the existing Evidergy CarbonOps web product (../app) as a
 * native shell via Capacitor's "server" mode -- it loads a live URL rather
 * than bundling a static export, because the product is a dynamic app
 * (server-rendered pages, cookie-based auth, API routes), not a static site.
 *
 * PLACEHOLDERS that must be replaced before any real store submission:
 * - appId: reverse-DNS bundle identifier. "com.evidergy.carbonops" is a
 *   reasonable default but must match whatever you register in App Store
 *   Connect / Google Play Console -- it cannot be changed after first
 *   submission without shipping as a new app.
 * - server.url: currently a placeholder. There is no public production
 *   deployment of this app yet (see mobile-app/README.md) -- this must
 *   point at a real HTTPS backend before building a release artifact.
 */
const config: CapacitorConfig = {
  appId: "com.evidergy.carbonops",
  appName: "Evidergy CarbonOps",
  webDir: "www",
  server: {
    url: "https://REPLACE-WITH-DEPLOYED-URL.example.com",
    cleartext: false,
  },
};

export default config;
