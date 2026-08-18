import { Badge, KpiCard, MethodologyNote, PageHeader, Panel, Progress } from "@/components/ui";
import { alerts, energySeries, pvArrays, pvEvidence, siteAExemplarDay } from "@/lib/reference-dataset";
import { EnergyChart } from "@/components/charts";

export default function PvHealthPage() {
  const pvAlert = alerts.find((a) => a.id === "REF-PV-INJ") ?? alerts[0];
  const peakPvKw = Math.max(...energySeries.map((p) => p.pvKw));
  return (
    <>
      <PageHeader eyebrow="Weather-adjusted, fault-injection validated" title="PV health" description="Compare real PV output with a weather-adjusted baseline trained on real Konstanz irradiance and temperature, before estimating lost generation." action={<button className="button buttonPrimary">Create work-order draft</button>} />
      <div className="kpiGrid">
        <KpiCard label="Known-event recall" value={pvEvidence.known_event_recall_pct.toFixed(1)} unit="%" tone="green" trend="Target ≥80%" detail="Synthetic outages injected into real held-out PV" />
        <KpiCard label="Peak output, real day" value={peakPvKw.toFixed(2)} unit="kW" trend={siteAExemplarDay} detail="Real residential4 PV meter" />
        <KpiCard label="Estimated loss (test window)" value={pvEvidence.estimated_lost_kwh_test_window.toFixed(1)} unit="kWh" tone="amber" trend="Nov–Dec 2016" detail="P50-baseline shortfall, real held-out window" />
        <KpiCard label="False-positive rate" value={pvEvidence.false_positive_rate_pct_on_clean_daytime.toFixed(2)} unit="%" tone="cyan" trend="On clean real intervals" detail="Backtest, not live production" />
      </div>
      <Panel title="Reference PV system" description="Weather correction + fault-injection validation (only one instrumented system in this public dataset)">
        <div className="assetCards">{pvArrays.map((array) => <article className="assetCard" key={array.name}><div><span>{array.name}</span><Badge tone="good">{array.status}</Badge></div><strong>{array.actualKw} <em>kWh today</em></strong><small>{array.note}</small><Progress value={array.health} tone={array.health < 75 ? "red" : array.health < 95 ? "amber" : "green"} label={`Health ${array.health}%`} /></article>)}</div>
      </Panel>
      <div className="dashboardGrid">
        <Panel title="Real PV output, 15-minute resolution" description={`${siteAExemplarDay} · residential4 · real meter, not simulated`} className="span2"><EnergyChart points={energySeries.map((point) => ({ ...point, loadKw: point.pvKw, gridKw: 0, bessKw: 0 }))} /></Panel>
        <Panel title="Priority evidence" description={`${pvAlert.id} · ${pvAlert.asset}`}><div className="evidenceCard"><Badge tone="danger">High priority</Badge><h3>{pvAlert.title}</h3><p>{pvAlert.detail}</p><dl><div><dt>Confidence</dt><dd>{Math.round(pvAlert.confidence * 100)}%</dd></div><div><dt>Estimated loss</dt><dd>{pvAlert.impactKwh} kWh</dd></div><div><dt>Duration</dt><dd>{pvAlert.duration}</dd></div></dl><ul>{pvAlert.evidence.map((evidence) => <li key={evidence}>✓ {evidence}</li>)}</ul><p className="boundaryNote"><strong>Boundary:</strong> Candidate underperformance, not a deterministic component root cause.</p></div></Panel>
      </div>
      <MethodologyNote>{pvEvidence.baseline_model} Held out: {pvEvidence.held_out_test_window}. {pvEvidence.fault_injection_method}</MethodologyNote>
    </>
  );
}
