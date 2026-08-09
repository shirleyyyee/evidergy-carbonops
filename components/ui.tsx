import type { ReactNode } from "react";

export function Badge({ tone = "neutral", children }: { tone?: "good" | "warn" | "danger" | "info" | "neutral"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className="pageHeader">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="pageDescription">{description}</p>
      </div>
      {action ? <div className="pageActions">{action}</div> : null}
    </header>
  );
}

export function Panel({ title, description, action, children, className = "" }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {title || description || action ? (
        <div className="panelHeader">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function KpiCard({ label, value, unit, trend, tone = "navy", detail }: { label: string; value: string; unit?: string; trend?: string; tone?: "navy" | "green" | "cyan" | "amber"; detail?: string }) {
  return (
    <article className={`kpiCard kpi-${tone}`}>
      <div className="kpiTop"><span>{label}</span>{trend ? <small>{trend}</small> : null}</div>
      <strong>{value}<em>{unit}</em></strong>
      {detail ? <p>{detail}</p> : null}
    </article>
  );
}

export function Progress({ value, tone = "green", label }: { value: number; tone?: "green" | "cyan" | "amber" | "red"; label?: string }) {
  return (
    <div className="progressWrap" aria-label={label ?? `${value}%`}>
      <div className="progressTrack"><span className={`progressFill progress-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
      {label ? <small>{label}</small> : null}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="emptyState"><span>✓</span><h3>{title}</h3><p>{detail}</p></div>;
}

/**
 * Provenance/limitation callout used across product pages so every real
 * number on screen is traceable to its source and honest about what it does
 * and doesn't prove. See /methodology for the full record.
 */
export function MethodologyNote({ children }: { children: ReactNode }) {
  return (
    <p className="boundaryNote methodologyNote">
      <strong>Data &amp; methodology: </strong>
      {children}{" "}
      <a className="textLink" href="/methodology">Full record →</a>
    </p>
  );
}
