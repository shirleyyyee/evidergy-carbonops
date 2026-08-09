import { getD1 } from "./index";

let ready = false;

export async function ensureActionTables() {
  if (ready) return;
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS alert_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_alert_actions_alert_created
      ON alert_actions(alert_id, created_at)`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      site_id TEXT,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_logs_site_created
      ON audit_logs(site_id, created_at)`),
  ]);
  await d1.prepare("PRAGMA optimize").run();
  ready = true;
}
