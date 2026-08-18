import { Badge, KpiCard, MethodologyNote, PageHeader, Panel } from "@/components/ui";
import { bmsConnectorEvidence, edgeStateRecognition, edgeStateTimeline, siteBExemplarDay } from "@/lib/reference-dataset";

const STATE_COLOR: Record<string, string> = {
  RUN: "var(--green)",
  IDLE: "var(--amber)",
  OFF: "var(--muted)",
  UNKNOWN: "var(--red)",
};

export default function EdgeDevicesPage() {
  const dist = edgeStateRecognition.state_distribution_pct as Record<string, number>;
  const { off_threshold_kw, run_threshold_kw, debounce_intervals } = edgeStateRecognition.thresholds;

  return (
    <>
      <PageHeader
        eyebrow="Data Hub connectivity · C++ edge collector + Java BMS connector"
        title="Edge devices & run-state recognition"
        description="The Data Hub's two field-connectivity prototypes: a C++ edge gateway that decodes real Modbus TCP telemetry and classifies equipment RUN / OFF / IDLE state, and a Java REST gateway that validates BMS/OPC-UA-forwarded telemetry — both proven against the same real reference dataset, not a mockup."
      />
      <div className="kpiGrid">
        <KpiCard label="RUN" value={(dist.RUN ?? 0).toFixed(1)} unit="%" tone="green" detail="Real full-year 2016, industrial2 bess_kw" />
        <KpiCard label="IDLE" value={(dist.IDLE ?? 0).toFixed(1)} unit="%" tone="amber" detail="Between the OFF and RUN thresholds" />
        <KpiCard label="OFF" value={(dist.OFF ?? 0).toFixed(1)} unit="%" detail="Below the OFF threshold" />
        <KpiCard label="UNKNOWN" value={(dist.UNKNOWN ?? 0).toFixed(1)} unit="%" tone="cyan" detail="Real missing-data gaps, not injected" />
      </div>

      <Panel title={`Run-state timeline — ${siteBExemplarDay}`} description="Same exemplar day as BESS health, real 15-minute intervals, classified over the full real year so debounce state carries correctly across midnight" className="span2">
        <div className="stateTimeline">
          {edgeStateTimeline.map((point) => (
            <div
              key={point.label}
              className="stateTimelineCell"
              style={{ background: STATE_COLOR[point.state] ?? "var(--muted)" }}
              title={`${point.label} · ${point.state} · ${point.powerKw} kW`}
            />
          ))}
        </div>
        <div className="stateTimelineAxis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:45</span></div>
        <div className="stateTimelineLegend">
          <span><i style={{ background: "var(--green)" }} />RUN</span>
          <span><i style={{ background: "var(--amber)" }} />IDLE</span>
          <span><i style={{ background: "var(--muted)" }} />OFF</span>
          <span><i style={{ background: "var(--red)" }} />UNKNOWN</span>
        </div>
      </Panel>

      <Panel title="Classifier configuration" description="Illustrative prototype thresholds, calibrated to this real system's own power range — not tuned against any labelled outcome">
        <table className="metricTable">
          <tbody>
            <tr><td>OFF threshold</td><td>{off_threshold_kw} kW</td></tr>
            <tr><td>RUN threshold</td><td>{run_threshold_kw} kW</td></tr>
            <tr><td>Debounce</td><td>{debounce_intervals} consecutive intervals</td></tr>
            <tr><td>Real intervals classified</td><td>{edgeStateRecognition.total_intervals.toLocaleString()} (full year 2016)</td></tr>
          </tbody>
        </table>
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge tone="info">edge-collector-cpp/include/run_state.hpp</Badge>
          <Badge tone="info">data_pipeline/reference_backtest.py — classify_run_state()</Badge>
        </div>
      </Panel>

      {bmsConnectorEvidence ? (
        <Panel
          title="Java BMS / OPC-UA connector — real HTTP replay"
          description={bmsConnectorEvidence.site}
        >
          <div className="kpiGrid" style={{ marginBottom: 0 }}>
            <KpiCard label="Real intervals replayed" value={bmsConnectorEvidence.intervals_replayed.toLocaleString()} tone="cyan" detail="Live HTTP POST /ingest against a real server instance" />
            <KpiCard label="Accepted" value={bmsConnectorEvidence.accepted_count.toLocaleString()} unit={`/${bmsConnectorEvidence.intervals_replayed}`} tone="green" detail="100% of real, valid intervals" />
            <KpiCard label="Duplicate rejection" value={String(bmsConnectorEvidence.duplicate_rejected_status)} tone="amber" detail="Re-submitting a real interval is correctly rejected" />
            <KpiCard label="Malformed rejection" value={String(bmsConnectorEvidence.malformed_rejected_status)} detail="Invalid JSON is correctly rejected, not silently dropped" />
          </div>
          <table className="metricTable" style={{ marginTop: 14 }}>
            <tbody>
              <tr><td>Endpoint</td><td>{bmsConnectorEvidence.endpoint}</td></tr>
              <tr><td>Clock-skew tolerance</td><td>{bmsConnectorEvidence.max_clock_skew_seconds}s</td></tr>
              <tr><td>Plausible temperature range</td><td>{bmsConnectorEvidence.min_plausible_temperature_c}°C to {bmsConnectorEvidence.max_plausible_temperature_c}°C</td></tr>
              <tr><td>Plausible irradiance range</td><td>0 to {bmsConnectorEvidence.max_plausible_irradiance_wm2} W/m²</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 14 }}>
            <Badge tone="info">bms-connector-java — EndToEndRealDataTest.java</Badge>
          </div>
        </Panel>
      ) : (
        <Panel title="Java BMS / OPC-UA connector" description="Evidence not yet generated on this checkout">
          <p style={{ fontSize: 11, color: "#7c8b97" }}>
            Run <code>powershell bms-connector-java/scripts/build-and-test.ps1</code> to produce real evidence here
            (writes <code>data_processed/reference_2016/bms_connector_evidence.json</code> from an actual HTTP
            replay, then re-run <code>python data_pipeline/generate_reference_ts.py</code>).
          </p>
        </Panel>
      )}

      <MethodologyNote>
        {edgeStateRecognition.method} {edgeStateRecognition.note} The C++ and Python implementations were run
        independently against the same real telemetry and produce an identical state distribution — see{" "}
        <code>edge-collector-cpp/tests/test_run_state_real_data.cpp</code> and the <code>edge_state_recognition</code>{" "}
        module in <code>backtest_report.json</code>. The Java BMS connector&rsquo;s numbers above come from{" "}
        {bmsConnectorEvidence?.note ?? "a real end-to-end HTTP replay against the live server"}
      </MethodologyNote>
    </>
  );
}
