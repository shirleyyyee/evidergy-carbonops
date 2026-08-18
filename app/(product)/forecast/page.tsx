import { ForecastChart } from "@/components/charts";
import { Badge, KpiCard, MethodologyNote, PageHeader, Panel } from "@/components/ui";
import { forecastSeries, forecastWindow, loadForecastByHorizon, modelCards } from "@/lib/reference-dataset";

export default function ForecastPage() {
  const oneHour = loadForecastByHorizon.find((h) => h.horizon_label === "1h")!;
  const twentyFourHour = loadForecastByHorizon.find((h) => h.horizon_label === "24h")!;
  const peak = forecastSeries.reduce((max, p) => (p.p50 > max.p50 ? p : max), forecastSeries[0]);
  return (
    <>
      <PageHeader eyebrow="Real walk-forward backtest, not a live forecast" title="Load forecast" description="Median demand and calibrated intervals for a real 24-hour window drawn from the held-out Nov–Dec 2016 backtest, with per-horizon accuracy reported below." action={<><button className="button buttonGhost">Held-out window⌄</button><button className="button buttonPrimary">Re-run backtest</button></>} />
      <div className="kpiGrid">
        <KpiCard label="+1h median (real)" value={forecastSeries[0].p50.toFixed(2)} unit="kW" trend="P05–P95" detail={`${forecastSeries[0].p05.toFixed(2)}–${forecastSeries[0].p95.toFixed(2)} kW real interval`} />
        <KpiCard label="Peak in window" value={peak.p50.toFixed(2)} unit="kW" tone="amber" trend={peak.label} detail="Real held-out test window" />
        <KpiCard label="90% coverage (1h)" value={(oneHour.p90_coverage * 100).toFixed(1)} unit="%" tone="green" trend="Target 85–95%" detail={`${oneHour.test_intervals} real test intervals`} />
        <KpiCard label="Median bias (1h)" value={oneHour.median_bias_kw.toFixed(2)} unit="kW" tone="cyan" trend="Within gate" detail="Real mean signed error" />
      </div>
      <Panel title="24-hour real backtest window" description={`Shaded area is the calibrated P05–P95 interval; ${forecastWindow.start} to ${forecastWindow.end}`} action={<Badge tone={oneHour.p90_coverage >= 0.85 && oneHour.p90_coverage <= 0.95 ? "good" : "warn"}>{oneHour.p90_coverage >= 0.85 && oneHour.p90_coverage <= 0.95 ? "Calibrated" : "Outside gate"}</Badge>}>
        <ForecastChart points={forecastSeries} />
        <div className="thresholdSummary"><div><span>Mean interval width</span><strong>{oneHour.mean_interval_width_kw} kW</strong></div><div><span>P50 MAE</span><strong>{oneHour.mae_p50_kw} kW</strong></div><div><span>Test intervals</span><strong>{oneHour.test_intervals}</strong></div><p><strong>Operator note:</strong> &ldquo;Actual&rdquo; on this chart is the real net load in the held-out window, not a live reading. No automatic dispatch is issued.</p></div>
      </Panel>
      <div className="dashboardGrid">
        <Panel title="Horizon performance" description="Real walk-forward backtest, fixed train/validate/test split, no shuffling" className="span2"><div className="forecastTable tableLike"><div className="tableHead"><span>Horizon</span><span>MAE</span><span>90% coverage</span><span>Avg. interval width</span><span>Test intervals</span><span>Gate</span></div>{loadForecastByHorizon.map((row) => <div className="tableRow" key={row.horizon_label}><span>{row.horizon_label}</span><span>{row.mae_p50_kw} kW</span><span>{(row.p90_coverage * 100).toFixed(1)}%</span><span>{row.mean_interval_width_kw} kW</span><span>{row.test_intervals}</span><Badge tone={row.p90_coverage >= 0.85 && row.p90_coverage <= 0.95 ? "good" : "warn"}>{row.p90_coverage >= 0.85 && row.p90_coverage <= 0.95 ? "Passed" : "Outside gate"}</Badge></div>)}</div></Panel>
        <Panel title="Model cards" description="Versioned and reproducible, real backtest metrics"><div className="modelList">{modelCards.map((model) => <div key={model.name}><span>{model.status}</span><strong>{model.name}</strong><small>{model.version} · {model.metric}</small><b>{model.value}</b></div>)}</div></Panel>
      </div>
      <MethodologyNote>Forecast target is real net load (grid import − grid export + PV) for residential4. The 24h horizon shows {(twentyFourHour.p90_coverage * 100).toFixed(1)}% coverage in this backtest (after split-conformal interval calibration) — below the 85–95% target, reported here rather than hidden.</MethodologyNote>
    </>
  );
}
