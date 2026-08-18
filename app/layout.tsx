import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    title: { default: "Evidergy CarbonOps", template: "%s · Evidergy" },
    description: "Read-only microgrid intelligence for energy flow, probabilistic forecasting, PV/BESS evidence and versioned Scope 2 accounting.",
    icons: { icon: "/evidergy-logo.png", shortcut: "/evidergy-logo.png" },
    openGraph: { title: "Evidergy CarbonOps", description: "See energy risk before it becomes operational loss.", type: "website", images: [{ url: "/og.png", width: 1536, height: 804, alt: "Evidergy CarbonOps evidence-first microgrid intelligence" }] },
    twitter: { card: "summary_large_image", title: "Evidergy CarbonOps", description: "Evidence-first microgrid intelligence.", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;750;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
