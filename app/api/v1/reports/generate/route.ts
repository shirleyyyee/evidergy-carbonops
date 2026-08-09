import { requireApiUser } from "@/lib/auth";
import { buildReportPayload, generateOperationsReport } from "@/lib/report-generation";

export async function POST() {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });

  const result = await generateOperationsReport();
  if (!result.ok) {
    const status = result.error === "not_configured" ? 501 : result.error === "refused" ? 422 : 502;
    return Response.json({ error: result.error, detail: result.detail }, { status });
  }

  return Response.json({
    data: { report: result.report, model: result.model, generatedAt: new Date().toISOString() },
    meta: {
      requestedBy: user.email,
      // Echoes the exact keys sent to the model, so the caller can audit the
      // privacy boundary without re-deriving it -- no raw telemetry keys ever
      // appear here.
      payloadKeys: Object.keys(buildReportPayload()),
    },
  });
}
