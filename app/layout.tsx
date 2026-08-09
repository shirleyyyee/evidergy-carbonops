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
    title: { default: "Periscope Energy CarbonOps", template: "%s · Periscope" },
    description: "Read-only microgrid intelligence for energy flow, probabilistic forecasting, PV/BESS evidence and versioned Scope 2 accounting.",
    icons: { icon: "/periscope-logo.png", shortcut: "/periscope-logo.png" },
    openGraph: { title: "Periscope Energy CarbonOps", description: "See energy risk before it becomes operational loss.", type: "website", images: [{ url: "/og.png", width: 1536, height: 804, alt: "Periscope Energy CarbonOps evidence-first microgrid intelligence" }] },
    twitter: { card: "summary_large_image", title: "Periscope Energy CarbonOps", description: "Evidence-first microgrid intelligence.", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
