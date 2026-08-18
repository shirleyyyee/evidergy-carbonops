import Link from "next/link";
import type { ReactNode } from "react";
import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import type { ProductUser } from "@/lib/auth";
import { alerts, dataVersion, site } from "@/lib/reference-dataset";

const nav = [
  { href: "/dashboard", label: "Energy overview", icon: "⌁" },
  { href: "/data-quality", label: "Data quality", icon: "◇" },
  { href: "/pv-health", label: "PV health", icon: "☼" },
  { href: "/bess-health", label: "BESS health", icon: "▣" },
  { href: "/forecast", label: "Forecast", icon: "∿" },
  { href: "/carbon-ledger", label: "Carbon ledger", icon: "◉" },
  { href: "/alerts", label: "Alerts & evidence", icon: "!" },
  { href: "/reports", label: "AI report", icon: "✎" },
  { href: "/methodology", label: "Data & methodology", icon: "▤" },
];

export function ProductShell({ user, children }: { user: ProductUser; children: ReactNode }) {
  return (
    <div className="productShell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" aria-label="Evidergy home">
          <span className="brandMark"><i /><i /><i /></span>
          <span><strong>EVIDERGY</strong><small>CARBONOPS</small></span>
        </Link>
        <div className="sitePicker">
          <span>Active site</span>
          <strong>{site.name}</strong>
          <small>{site.location}</small>
        </div>
        <nav aria-label="Product navigation">
          {nav.map((item) => <Link href={item.href} key={item.href}><span>{item.icon}</span>{item.label}{item.href === "/alerts" && alerts.length ? <b>{alerts.length}</b> : null}</Link>)}
        </nav>
        <div className="sidebarFooter">
          <div className="readOnly"><span>●</span><div><strong>Read-only connection</strong><small>No control commands</small></div></div>
          <Link href="/settings" className="userCard"><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div></Link>
        </div>
      </aside>
      <div className="mainColumn">
        <header className="topbar">
          <div className="mobileBrand"><span className="brandMark"><i /><i /><i /></span><strong>EVIDERGY</strong></div>
          <div className="connectionStatus"><span>●</span>{site.status}<small>Updated {site.lastUpdated}</small></div>
          <div className="topbarActions">
            <Link href="/settings">Settings</Link>
            {user.authSource === "local" ? (
              <form method="post" action="/api/local-logout" style={{ display: "inline" }}>
                <button type="submit" className="textButton" style={{ font: "inherit", fontWeight: 700, color: "inherit" }}>Sign out</button>
              </form>
            ) : (
              <a href={chatGPTSignOutPath("/")}>Sign out</a>
            )}
          </div>
        </header>
        <main className="productMain">{children}</main>
        <footer className="productFooter"><span>Operational analytics only — not a statutory audit or control system.</span><span>Data version {dataVersion}</span></footer>
      </div>
    </div>
  );
}
