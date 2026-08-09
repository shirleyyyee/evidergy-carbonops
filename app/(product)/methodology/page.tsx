import { Badge, PageHeader, Panel } from "@/components/ui";
import {
  bessEfficiency,
  bessEvidence,
  dataQuality,
  dataVersion,
  deepLearningForecast,
  energyBalance,
  limitations,
  loadForecastByHorizon,
  loadForecastMetrics,
  modelVersion,
  pvEvidence,
  scope2,
  sources,
} from "@/lib/reference-dataset";

export default function MethodologyPage() {
  return (
    <div className="methodologyPage">
      <PageHeader
        eyebrow="Technical validation record"
        title="Data & methodology"
        description="Every number in this workspace traces to a real, checksummed public dataset and a versioned backtest. This page is the live, in-product version of the short technical validation record submitted with the commercialisation application."
      />

      <Panel title="What this is, and is not" description="Read this before any number on this page">
        <p style={{ fontSize: 11, lineHeight: 1.7, color: "#5c6f7f" }}>
          This is a <strong>public reference dataset</strong> — Open Power System Data household_data (real
          smart-meter telemetry from Konstanz, Germany), Open-Meteo historical weather, and the DCCEEW National
          Greenhouse Accounts Factors 2025 — used to backtest the algorithms in <code>data_pipeline/core_models.py</code>{" "}
          end-to-end on real, non-synthetic measurements. It is deliberately <strong>not</strong> presented as the
          Alice Springs / DKP pilot dataset, which still requires written commercial-use permission from DKA Solar
          Centre (see <code>data_pipeline/sources.json</code>) and is the target of the Sprint 1–4 rollout in{" "}
          <code>docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md</code>. Reproduce this record with{" "}
          <code>python data_pipeline/reference_backtest.py</code> then{" "}
          <code>python data_pipeline/generate_reference_ts.py</code>.
        </p>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginTop: 14, fontSize: 10 }}>
          <div><dt style={{ color: "#8b98a3" }}>Data version</dt><dd style={{ margin: "3px 0 0", fontWeight: 700, color: "#3e5162" }}>{dataVersion}</dd></div>
          <div><dt style={{ color: "#8b98a3" }}>Model / backtest version</dt><dd style={{ margin: "3px 0 0", fontWeight: 700, color: "#3e5162" }}>{modelVersion}</dd></div>
        </dl>
      </Panel>

      <Panel title="Real public data sources" description="Downloaded programmatically, checksummed, no login required for any of them">
        <div className="sourceGrid">
          {sources.map((source) => (
            <article key={source.id}>
              <strong>{source.name}</strong>
              <span style={{ fontSize: 9, color: "#7c8b97" }}>{source.publisher} · {source.licence}</span>
              <small>{source.file}</small>
              <small>sha256 {source.sha256.slice(0, 16)}…</small>
              <a className="textLink" href={source.url} target="_blank" rel="noreferrer">Source →</a>
            </article>
          ))}
        </div>
      </Panel>

      <div className="dashboardGrid">
        <Panel title="Energy balance" description="residential4, real grid + PV + appliance meters, 2016" className="span2">
          <table className="metricTable">
            <thead><tr><th>Check</th><th>What it validates</th><th>Result</th></tr></thead>
            <tbody>
              <tr><td>Identity check</td><td>{energyBalance.identity_check.description}</td><td><Badge tone="good">{energyBalance.identity_check.pass_pct}% pass</Badge></td></tr>
              <tr><td>Submetered check</td><td>{energyBalance.submetered_check.description}</td><td><Badge tone="warn">{energyBalance.submetered_check.pass_pct}% pass</Badge></td></tr>
              <tr><td>Metering completeness</td><td>Submeters vs. whole-building identity load</td><td><Badge tone="info">{energyBalance.metering_completeness_pct}%</Badge></td></tr>
            </tbody>
          </table>
        </Panel>
        <Panel title="Data quality gate" description="industrial2 storage telemetry, real gaps">
          <table className="metricTable">
            <tbody>
              <tr><td>Missing</td><td>{dataQuality.missing_pct}%</td></tr>
              <tr><td>Frozen (naive heuristic)</td><td>{dataQuality.frozen_intervals} intervals</td></tr>
              <tr><td>Jump outliers</td><td>{dataQuality.jump_intervals} intervals</td></tr>
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Probabilistic load forecast — real walk-forward backtest by horizon" description={loadForecastMetrics.split}>
        <table className="metricTable">
          <thead><tr><th>Horizon</th><th>Test intervals</th><th>P50 MAE (kW)</th><th>90% coverage</th><th>Mean interval width (kW)</th><th>Median bias (kW)</th><th>Gate (85–95%)</th></tr></thead>
          <tbody>
            {loadForecastByHorizon.map((row) => (
              <tr key={row.horizon_label}>
                <td>{row.horizon_label}</td>
                <td>{row.test_intervals}</td>
                <td>{row.mae_p50_kw}</td>
                <td>{(row.p90_coverage * 100).toFixed(1)}%</td>
                <td>{row.mean_interval_width_kw}</td>
                <td>{row.median_bias_kw}</td>
                <td>{row.p90_coverage >= 0.85 && row.p90_coverage <= 0.95 ? <Badge tone="good">Passed</Badge> : <Badge tone="warn">Outside gate</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Deep learning forecaster — LSTM vs. the gradient-boosted baseline"
        description={`${deepLearningForecast.model} · ${deepLearningForecast.split}`}
      >
        <table className="metricTable">
          <thead><tr><th>Model</th><th>P50 MAE (kW)</th><th>90% coverage</th><th>Mean interval width (kW)</th><th>Median bias (kW)</th></tr></thead>
          <tbody>
            <tr>
              <td>Baseline — Gradient boosted trees</td>
              <td>{deepLearningForecast.baseline_comparison.gradient_boosting_mae_p50_kw}</td>
              <td>{(loadForecastByHorizon[0].p90_coverage * 100).toFixed(1)}%</td>
              <td>{loadForecastByHorizon[0].mean_interval_width_kw}</td>
              <td>{loadForecastByHorizon[0].median_bias_kw}</td>
            </tr>
            <tr>
              <td>Deep learning — {deepLearningForecast.model}</td>
              <td>
                <Badge tone={deepLearningForecast.baseline_comparison.lstm_beats_baseline_on_mae ? "good" : "warn"}>
                  {deepLearningForecast.metrics.mae_p50_kw}
                </Badge>
              </td>
              <td>{(deepLearningForecast.metrics.p90_coverage * 100).toFixed(1)}%</td>
              <td>{deepLearningForecast.metrics.mean_interval_width_kw}</td>
              <td>{deepLearningForecast.metrics.median_bias_kw}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 10.5, lineHeight: 1.7, color: "#7c8b97", marginTop: 10 }}>{deepLearningForecast.honesty_note}</p>
      </Panel>

      <div className="dashboardGrid">
        <Panel title="PV evidence — fault-injection validation" description="residential4 real PV, weather-adjusted baseline">
          <table className="metricTable">
            <tbody>
              <tr><td>Method</td><td>{pvEvidence.fault_injection_method}</td></tr>
              <tr><td>Known-event recall</td><td><Badge tone={pvEvidence.known_event_recall_pct >= 80 ? "good" : "warn"}>{pvEvidence.known_event_recall_pct}%</Badge> (target ≥80%)</td></tr>
              <tr><td>False-positive rate</td><td>{pvEvidence.false_positive_rate_pct_on_clean_daytime}% on clean real daytime intervals</td></tr>
            </tbody>
          </table>
        </Panel>
        <Panel title="BESS evidence — fault-injection validation" description="industrial2 real behind-the-meter battery">
          <table className="metricTable">
            <tbody>
              <tr><td>Deadband</td><td>{bessEvidence.deadband_kw} kW (site-calibrated)</td></tr>
              <tr><td>Injected-fault recall</td><td><Badge tone={bessEvidence.injected_fault_recall_pct >= 80 ? "good" : "warn"}>{bessEvidence.injected_fault_recall_pct}%</Badge></td></tr>
              <tr><td>False-positive rate</td><td>{bessEvidence.false_positive_rate_pct_on_clean_intervals}% on clean real intervals</td></tr>
              <tr><td>Round-trip efficiency (real, full year)</td><td>{bessEfficiency.round_trip_efficiency_pct}%</td></tr>
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Scope 2 recompute" description="Real monthly grid import × real published NT (DKIS) factor">
        <table className="metricTable">
          <tbody>
            <tr><td>Factor</td><td>{scope2.factor_kg_co2e_per_kwh} kg CO₂-e/kWh — {scope2.factor_source}</td></tr>
            <tr><td>Months evaluated</td><td>{scope2.months_evaluated}</td></tr>
            <tr><td>Total grid import</td><td>{scope2.total_grid_import_mwh} MWh</td></tr>
            <tr><td>Total emissions</td><td>{scope2.total_emissions_tco2e} tCO₂-e</td></tr>
            <tr><td>Recompute consistency</td><td><Badge tone="good">{scope2.recompute_consistency_pct}%</Badge> (BP target: 100%)</td></tr>
          </tbody>
        </table>
      </Panel>

      <Panel title="Limitations, stated plainly" description="What this record does not claim">
        <ul className="limitationsList">
          {limitations.map((item) => <li key={item.slice(0, 40)}>{item}</li>)}
        </ul>
      </Panel>
    </div>
  );
}
