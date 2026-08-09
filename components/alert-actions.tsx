"use client";

import { useState } from "react";

export function AlertActions({ alertId }: { alertId: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function act(action: "acknowledge" | "investigate") {
    setState("saving");
    const response = await fetch(`/api/v1/alerts/${alertId}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, note: "Updated from evidence workspace" }),
    });
    setState(response.ok ? "saved" : "error");
  }
  return (
    <div className="alertActions">
      <button className="button buttonGhost" onClick={() => act("acknowledge")} disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Acknowledge"}</button>
      <button className="button buttonPrimary" onClick={() => act("investigate")} disabled={state === "saving"}>Investigate</button>
      {state === "saved" ? <small className="saveGood">Saved to audit trail</small> : null}
      {state === "error" ? <small className="saveError">Could not save; retry</small> : null}
    </div>
  );
}
