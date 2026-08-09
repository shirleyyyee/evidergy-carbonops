import { ensureActionTables } from "@/db/bootstrap";
import { getD1 } from "@/db";
import { requireApiUser } from "@/lib/auth";
import { alerts, site } from "@/lib/reference-dataset";

const allowedActions = new Set(["acknowledge", "investigate", "resolve", "false_positive"]);

export async function POST(request: Request, { params }: { params: Promise<{ alertId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const { alertId } = await params;
  if (!alerts.some((alert) => alert.id === alertId)) return Response.json({ error: "alert_not_found" }, { status: 404 });
  const payload = await request.json() as { action?: string; note?: string };
  const action = payload.action?.trim() ?? "";
  const note = payload.note?.trim().slice(0, 1000) ?? "";
  if (!allowedActions.has(action)) return Response.json({ error: "invalid_action" }, { status: 400 });
  try {
    await ensureActionTables();
    const d1 = getD1();
    await d1.batch([
      d1.prepare("INSERT INTO alert_actions (alert_id, user_id, action, note) VALUES (?, ?, ?, ?)").bind(alertId, user.userId, action, note),
      d1.prepare("INSERT INTO audit_logs (user_id, site_id, event_type, entity_type, entity_id, payload_json) VALUES (?, ?, ?, ?, ?, ?)").bind(user.userId, site.id, "alert_action", "alert", alertId, JSON.stringify({ action, note })),
    ]);
    return Response.json({ data: { alertId, action, note, actor: user.email, saved: true } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "database_error";
    return Response.json({ error: "persistence_failed", detail: message }, { status: 500 });
  }
}
