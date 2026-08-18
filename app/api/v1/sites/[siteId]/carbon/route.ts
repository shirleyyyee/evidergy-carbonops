import { requireApiUser } from "@/lib/auth";
import { carbonFactor, carbonMonths, site } from "@/lib/reference-dataset";

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const { siteId } = await params;
  if (siteId !== site.id) return Response.json({ error: "site_not_found" }, { status: 404 });
  const format = new URL(request.url).searchParams.get("format");
  if (format === "csv") {
    const header = "month,grid_mwh,pv_mwh,scope2_tco2e,indicative_avoided_tco2e";
    const rows = carbonMonths.map((item) => [item.month, item.gridMwh, item.pvMwh, item.emissionsTco2e, item.avoidedTco2e].join(","));
    return new Response([header, ...rows].join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=evidergy-carbon-ledger.csv" } });
  }
  return Response.json({ data: carbonMonths, meta: { factor: { region: carbonFactor.region, year: carbonFactor.effectiveYear, valueKgCo2ePerKwh: carbonFactor.value, sourceVersion: carbonFactor.source }, disclaimer: "Operational estimate; not an NGER filing or assurance opinion." } });
}
