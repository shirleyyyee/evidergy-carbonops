import Anthropic from "@anthropic-ai/sdk";
import {
  alerts,
  bessEfficiency,
  bessEvidence,
  carbonFactor,
  carbonMonths,
  dashboardStats,
  dataQuality,
  energyBalance,
  loadForecastByHorizon,
  pvEvidence,
  qualityChecks,
  scope2,
  site,
} from "@/lib/reference-dataset";

/**
 * LLM-generated operations report — privacy-preserving by data minimisation.
 *
 * Only aggregated, already-public KPI-level figures (the same numbers already
 * rendered on /dashboard, /methodology, /carbon-ledger, etc.) are sent to the
 * model. Raw 15-minute interval telemetry (energySeries, bessSeries) never
 * leaves this process — a real deployment's per-interval site data can reveal
 * occupancy and operational patterns, which is exactly what this boundary is
 * designed to keep out of any third-party API call. See buildReportPayload()
 * for the exact allowlist; nothing outside it is ever serialised into the
 * request.
 *
 * Requires ANTHROPIC_API_KEY. Disabled (returns a clear, typed error) when
 * unset, rather than throwing — the rest of the product must keep working
 * without an API key configured.
 */

export type ReportPayload = ReturnType<typeof buildReportPayload>;

export function buildReportPayload() {
  return {
    site: { name: site.name, location: site.location, status: site.status },
    dashboard: dashboardStats,
    dataQuality: { ...dataQuality, checks: qualityChecks.map((c) => ({ name: c.name, status: c.status, score: c.score })) },
    energyBalance,
    loadForecastByHorizon,
    pvEvidence,
    bessEvidence,
    bessEfficiency,
    carbonFactor,
    carbonMonths,
    scope2Summary: {
      totalGridImportMwh: scope2.total_grid_import_mwh,
      totalEmissionsTco2e: scope2.total_emissions_tco2e,
      recomputeConsistencyPct: scope2.recompute_consistency_pct,
    },
    evidenceItems: alerts.map((a) => ({
      id: a.id,
      asset: a.asset,
      title: a.title,
      severity: a.severity,
      status: a.status,
      confidence: a.confidence,
      impactKwh: a.impactKwh,
    })),
  } as const;
}

export type GenerateReportResult =
  | { ok: true; report: string; model: string }
  | { ok: false; error: "not_configured" | "refused" | "api_error"; detail: string };

const SYSTEM_PROMPT = `You write short, factual operations reports for an energy/carbon monitoring product (Periscope Energy CarbonOps). You will be given a JSON payload of already-aggregated KPI figures -- never raw per-interval telemetry. Write a concise report (roughly 200-350 words) for a facilities/sustainability manager, covering: (1) headline energy and self-consumption picture, (2) data quality and energy-balance posture, (3) forecast calibration, noting explicitly if any horizon is outside its target band, (4) PV/BESS evidence findings, including real recall/false-positive figures, (5) Scope 2 position. Use only the numbers provided -- never invent a figure that is not in the payload. Where a figure is described as a backtest, a reference dataset, or not yet pilot-verified, say so plainly; do not present backtested reference-dataset results as live pilot performance. Plain prose, no markdown headers, no emoji.`;

export async function generateOperationsReport(): Promise<GenerateReportResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "not_configured",
      detail: "ANTHROPIC_API_KEY is not set. AI report generation is disabled until it is configured.",
    };
  }

  const client = new Anthropic({ apiKey });
  const payload = buildReportPayload();
  const model = "claude-opus-5";

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate the operations report from this aggregated data:\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "refused", detail: "The model declined to generate this report." };
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      return { ok: false, error: "api_error", detail: "Model returned no text content." };
    }

    return { ok: true, report: text, model: response.model };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error calling the Claude API.";
    return { ok: false, error: "api_error", detail };
  }
}
