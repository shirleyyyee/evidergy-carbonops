"use client";

import { useState } from "react";

type ReportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; report: string; model: string; payloadKeys: string[] }
  | { status: "error"; message: string };

export function AiReportGenerator() {
  const [state, setState] = useState<ReportState>({ status: "idle" });

  async function generate() {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/v1/reports/generate", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setState({ status: "error", message: body.detail ?? body.error ?? "Report generation failed." });
        return;
      }
      setState({
        status: "done",
        report: body.data.report,
        model: body.data.model,
        payloadKeys: body.meta.payloadKeys,
      });
    } catch {
      setState({ status: "error", message: "Network error contacting the report service." });
    }
  }

  return (
    <div>
      <button className="button buttonPrimary" onClick={generate} disabled={state.status === "loading"}>
        {state.status === "loading" ? "Generating…" : "Generate AI operations report"}
      </button>

      {state.status === "error" ? (
        <p className="boundaryNote" style={{ marginTop: 14 }}>
          <strong>Could not generate report:</strong> {state.message}
        </p>
      ) : null}

      {state.status === "done" ? (
        <div style={{ marginTop: 18 }}>
          <div className="evidenceStrip" style={{ marginBottom: 12 }}>
            <span>Model: {state.model}</span>
            <span>{state.payloadKeys.length} aggregated fields sent — no raw telemetry</span>
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.7, color: "#3d5264", whiteSpace: "pre-wrap" }}>{state.report}</p>
        </div>
      ) : null}
    </div>
  );
}
