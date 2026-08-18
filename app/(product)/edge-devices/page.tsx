import { Badge, KpiCard, MethodologyNote, PageHeader, Panel } from "@/components/ui";
import { edgeStateRecognition, edgeStateTimeline, siteBExemplarDay } from "@/lib/reference-dataset";

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
        eyebrow="C++ edge collector · real Modbus round-trip"
        title="Edge devices & run-state recognition"
        description="A field-gateway prototype (evidergy-edge-collector, C++17) decodes real Modbus TCP telemetry and classifies equipment RUN / OFF / IDLE state at the edge — the same generic algorithm cross-checked in an independent Python implementation on the same real data."
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

      <MethodologyNote>
        {edgeStateRecognition.method} {edgeStateRecognition.note} The C++ and Python implementations were run
        independently against the same real telemetry and produce an identical state distribution — see{" "}
        <code>edge-collector-cpp/tests/test_run_state_real_data.cpp</code> and the <code>edge_state_recognition</code>{" "}
        module in <code>backtest_report.json</code>.
      </MethodologyNote>
    </>
  );
}
