import { requireApiUser } from "@/lib/auth";
import { site } from "@/lib/reference-dataset";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  return Response.json({ data: [{ ...site, role: "owner" }], meta: { count: 1 } });
}
