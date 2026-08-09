import { AlertActions } from "@/components/alert-actions";
import { Badge, MethodologyNote, PageHeader, Panel } from "@/components/ui";
import { alerts } from "@/lib/reference-dataset";

const tone = { critical: "danger", warning: "warn", info: "info" } as const;

export default function AlertsPage() {
  const openOrInvestigating = alerts.filter((a) => a.status !== "resolved").length;
  const highPriority = alerts.filter((a) => a.severity === "critical").length;
  const totalImpact = alerts.reduce((sum, a) => sum + a.impactKwh, 0);
  return (
    <>
      <PageHeader eyebrow="Fault-injection validated evidence" title="Alerts & evidence" description="Each item below comes from a real backtest run against real public telemetry, with a stated detection method, recall and false-positive rate — not a live production feed." action={<button className="button buttonGhost">Backtest evidence⌄</button>} />
      <div className="alertSummary"><div><strong>{openOrInvestigating}</strong><span>Open or investigating</span></div><div><strong>{highPriority}</strong><span>High priority</span></div><div><strong>{totalImpact.toFixed(1)} kWh</strong><span>Estimated impact</span></div><div><strong>{alerts.length}</strong><span>Backtest evidence items</span></div></div>
      <div className="alertsWorkspace">
        {alerts.map((alert) => <Panel key={alert.id} className="alertPanel"><article id={alert.id} className="alertDetail"><div className="alertTitleRow"><div><Badge tone={tone[alert.severity]}>{alert.severity}</Badge><span>{alert.id} · {alert.asset}</span><h2>{alert.title}</h2></div><Badge tone={alert.status === "resolved" ? "good" : alert.status === "investigating" ? "warn" : "neutral"}>{alert.status}</Badge></div><p>{alert.detail}</p><div className="alertMetrics"><div><span>Started</span><strong>{alert.startedAt}</strong></div><div><span>Duration</span><strong>{alert.duration}</strong></div><div><span>Confidence</span><strong>{Math.round(alert.confidence * 100)}%</strong></div><div><span>Estimated impact</span><strong>{alert.impactKwh ? `${alert.impactKwh} kWh` : "Not quantified"}</strong></div></div><div className="evidenceStrip">{alert.evidence.map((item) => <span key={item}>✓ {item}</span>)}</div><div className="alertFooter"><small>Output is evidence for investigation, not a confirmed root cause.</small>{alert.status !== "resolved" ? <AlertActions alertId={alert.id} /> : <Badge tone="good">Resolved · audit retained</Badge>}</div></article></Panel>)}
      </div>
      <MethodologyNote>These three items are the outcome of the real backtest runs documented on the Data &amp; methodology page — fault-injection validation on real telemetry, not live alerting.</MethodologyNote>
    </>
  );
}
