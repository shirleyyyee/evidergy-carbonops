import { requireApiUser } from "@/lib/auth";
import { alerts, dataVersion, energySeries, modelVersion, qualityChecks, site } from "@/lib/reference-dataset";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const { siteId } = await params;
  if (siteId !== site.id) return Response.json({ error: "site_not_found" }, { status: 404 });
  const latest = energySeries[29];
  return Response.json({
    data: {
      site,
      timestamp: new Date().toISOString(),
      power: latest,
      dataQualityScore: qualityChecks.reduce((sum, check) => sum + check.score, 0) / qualityChecks.length,
      openAlertCount: alerts.filter((alert) => alert.status !== "resolved").length,
      boundaries: ["read_only", "operational_estimate", "human_confirmation_required"],
    },
    meta: { dataVersion, modelVersion },
  });
}
