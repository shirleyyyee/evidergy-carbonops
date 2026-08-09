import { Badge, KpiCard, MethodologyNote, PageHeader, Panel, Progress } from "@/components/ui";
import { bessEfficiency, bessEvidence, bessSeries, bessStats, siteBExemplarDay } from "@/lib/reference-dataset";
import { EnergyChart } from "@/components/charts";
import { diagnoseBess } from "@/lib/analytics";

export default function BessHealthPage() {
  const diagnostics = diagnoseBess(bessSeries);
  return (
    <>
      <PageHeader eyebrow="Real telemetry, fault-injection validated" title="BESS health" description="Monitor SOC–power agreement, throughput and efficiency without making cell-level claims — backtested on a real behind-the-meter battery, not simulated data." action={<button className="button buttonGhost">{siteBExemplarDay}⌄</button>} />
      <div className="kpiGrid">
        <KpiCard label="Charge-tracking index" value={bessStats.socPct.toFixed(1)} unit="%" tone="green" trend={bessStats.powerKw < 0 ? "Charging" : "Discharging"} detail="Indicative index, not an OEM SOC signal — see methodology" />
        <KpiCard label="Power" value={Math.abs(bessStats.powerKw).toFixed(2)} unit="kW" trend={bessStats.powerKw < 0 ? "Charging" : "Discharging"} detail="Real behind-the-meter battery (industrial2)" />
        <KpiCard label="Daily throughput" value={bessStats.dailyThroughputKwh.toFixed(1)} unit="kWh" tone="cyan" trend={`${bessStats.equivalentCycles} cycles`} detail={`Real day, ${siteBExemplarDay}`} />
        <KpiCard label="Round-trip efficiency" value={bessEfficiency.round_trip_efficiency_pct?.toFixed(1) ?? "—"} unit="%" tone="amber" trend="Real, full year 2016" detail={`${bessEfficiency.total_charge_kwh} kWh charged / ${bessEfficiency.total_discharge_kwh} kWh discharged`} />
      </div>
      <div className="dashboardGrid">
        <Panel title="Power and charge-tracking index" description="Positive power is discharge · real 15-minute telemetry" className="span2"><EnergyChart points={bessSeries.map((point) => ({ ...point, loadKw: point.socPct * 0.5, pvKw: Math.max(0, point.bessKw), gridKw: Math.min(0, point.bessKw) }))} /></Panel>
        <Panel title="Operating envelope" description="Calibrated to this real system's own power range"><div className="gaugeList"><div><span>Data-driven capacity estimate</span><strong>{bessStats.capacityKwh} kWh</strong><Progress value={100} tone="green" /></div><div><span>Deadband (site-calibrated)</span><strong>{bessEvidence.deadband_kw} kW</strong><Progress value={20} tone="cyan" /></div><div><span>Round-trip efficiency</span><strong>{bessEfficiency.round_trip_efficiency_pct}%</strong><Progress value={bessEfficiency.round_trip_efficiency_pct ?? 0} tone="amber" /></div></div></Panel>
      </div>
      <Panel title="Consistency checks" description="Evidence-level diagnostics; no cell voltage, cooling or insulation telemetry is available">
        <div className="checkCards">
          <article><Badge tone={diagnostics.inconsistentIntervals ? "warn" : "good"}>{diagnostics.inconsistentIntervals ? "Review" : "Passed"}</Badge><strong>SOC–power direction</strong><p>{diagnostics.inconsistentIntervals} of {bessSeries.length} real intervals on {siteBExemplarDay} require sign or telemetry-lag review.</p><small>Rule BESS-CONSISTENCY, reference backtest</small></article>
          <article><Badge tone="good">{bessEvidence.injected_fault_recall_pct}%</Badge><strong>Injected-fault recall</strong><p>{bessEvidence.fault_injection_method}</p><small>Target ≥80%</small></article>
          <article><Badge tone="info">{bessEvidence.false_positive_rate_pct_on_clean_intervals}%</Badge><strong>False-positive rate</strong><p>Direction-mismatch rate measured on clean, uncorrupted real intervals in the held-out window.</p><small>Held-out: {bessEvidence.held_out_test_window}</small></article>
          <article><Badge tone="good">{bessEfficiency.round_trip_efficiency_pct}%</Badge><strong>Round-trip efficiency</strong><p>Real total discharge ÷ real total charge, full year 2016 — not adjusted for standby losses.</p><small>{bessEfficiency.note}</small></article>
        </div>
      </Panel>
      <MethodologyNote>{bessEvidence.soc_derivation} Real site: industrial2, Open Power System Data household_data (CC-BY).</MethodologyNote>
    </>
  );
}
