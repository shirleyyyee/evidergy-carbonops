import { AiReportGenerator } from "@/components/ai-report";
import { MethodologyNote, PageHeader, Panel } from "@/components/ui";
import { buildReportPayload } from "@/lib/report-generation";

const FIELD_LABELS: Record<string, string> = {
  site: "Site profile — name, location, status",
  dashboard: "Dashboard KPI summary",
  dataQuality: "Data quality scores & checks",
  energyBalance: "Energy balance identity",
  loadForecastByHorizon: "Load forecast accuracy, by horizon",
  pvEvidence: "PV evidence findings",
  bessEvidence: "BESS evidence findings",
  bessEfficiency: "BESS round-trip efficiency",
  carbonFactor: "Grid carbon factor",
  carbonMonths: "Monthly carbon ledger totals",
  scope2Summary: "Scope 2 summary",
  evidenceItems: "Evidence / alert items — severity, confidence, impact",
};

function humanize(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export default function ReportsPage() {
  const payloadFields = Object.keys(buildReportPayload());
  return (
    <>
      <PageHeader
        eyebrow="LLM-generated, privacy-preserving"
        title="AI operations report"
        description="A narrative summary written by Claude from the same aggregated KPI figures already shown on this site — never raw 15-minute interval telemetry."
      />
      <div className="dashboardGrid">
        <Panel
          title="Generate a report"
          description="Calls the Claude API server-side; requires ANTHROPIC_API_KEY to be configured"
          className="span2"
        >
          <AiReportGenerator />
        </Panel>
        <Panel title="What the report covers" description="Five fixed sections, set by the model's own system prompt">
          <ol className="evidenceSteps">
            <li className="complete"><span>1</span><div><strong>Energy &amp; self-consumption</strong><small>Headline picture for the period</small></div></li>
            <li className="complete"><span>2</span><div><strong>Data quality &amp; balance</strong><small>Posture, not just a pass/fail count</small></div></li>
            <li className="complete"><span>3</span><div><strong>Forecast calibration</strong><small>Flags any horizon outside its target band</small></div></li>
            <li className="complete"><span>4</span><div><strong>PV / BESS evidence</strong><small>Real recall and false-positive figures</small></div></li>
            <li className="complete"><span>5</span><div><strong>Scope 2 position</strong><small>Grid import and emissions vs. baseline</small></div></li>
          </ol>
        </Panel>
      </div>
      <Panel
        title="Data sent to the model"
        description="Exact allowlist from buildReportPayload() — nothing outside it is ever serialised into the request"
      >
        <div className="scopeColumns">
          <article>
            <span>SENT — {payloadFields.length} aggregated fields</span>
            <ul>
              {payloadFields.map((key) => (
                <li key={key}>{FIELD_LABELS[key] ?? humanize(key)}</li>
              ))}
            </ul>
          </article>
          <article>
            <span>NEVER SENT</span>
            <ul>
              <li>Raw 15-minute site telemetry (energySeries)</li>
              <li>Raw BESS interval telemetry (bessSeries)</li>
              <li>Anything that could reveal occupancy or operational timing</li>
            </ul>
          </article>
        </div>
      </Panel>
      <MethodologyNote>
        Only aggregated, already-public figures (dashboard stats, quality scores, forecast metrics, evidence
        summaries, carbon totals) are sent to the model — see <code>lib/report-generation.ts</code>{" "}
        <code>buildReportPayload()</code> for the exact allowlist. Real per-interval site telemetry
        (<code>energySeries</code>, <code>bessSeries</code>) is never included in the request.
      </MethodologyNote>
    </>
  );
}
