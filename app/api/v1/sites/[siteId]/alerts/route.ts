import { requireApiUser } from "@/lib/auth";
import { alerts, site } from "@/lib/reference-dataset";

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const { siteId } = await params;
  if (siteId !== site.id) return Response.json({ error: "site_not_found" }, { status: 404 });
  const status = new URL(request.url).searchParams.get("status");
  const data = status ? alerts.filter((alert) => alert.status === status) : alerts;
  return Response.json({ data, meta: { count: data.length, modelOutputsAreRootCause: false } });
}
