import { AiReportGenerator } from "@/components/ai-report";
import { MethodologyNote, PageHeader, Panel } from "@/components/ui";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        eyebrow="LLM-generated, privacy-preserving"
        title="AI operations report"
        description="A narrative summary written by Claude from the same aggregated KPI figures already shown on this site — never raw 15-minute interval telemetry."
      />
      <Panel title="Generate a report" description="Calls the Claude API server-side; requires ANTHROPIC_API_KEY to be configured">
        <AiReportGenerator />
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
