export type AgentTask = {
  prompt: string;
  context?: string[];
};

export type AgentPlan = {
  intent: "investigate" | "report" | "monitor";
  priority: "high" | "medium" | "low";
  summary: string;
  actions: string[];
};

export function createAgentPlan(task: AgentTask): AgentPlan {
  const text = `${task.prompt} ${task.context?.join(" ") ?? ""}`.toLowerCase();

  if (text.includes("carbon") || text.includes("forecast") || text.includes("report")) {
    return {
      intent: "report",
      priority: "medium",
      summary: "Prepare a concise operations report with the latest evidence, forecast context, and carbon impact.",
      actions: [
        "Review the latest carbon ledger and forecast inputs.",
        "Summarize the key metrics for operations review.",
        "Prepare a shareable export or briefing note.",
      ],
    };
  }

  if (text.includes("alert") || text.includes("anomaly") || text.includes("investigate") || text.includes("evidence")) {
    return {
      intent: "investigate",
      priority: "high",
      summary: "Investigate the alert using the available site evidence and produce a cautious assessment.",
      actions: [
        "Inspect the relevant site and asset evidence.",
        "Check the latest quality and health indicators.",
        "Draft a short evidence-based summary for follow-up.",
      ],
    };
  }

  return {
    intent: "monitor",
    priority: "low",
    summary: "Monitor the current site conditions and capture any notable changes for review.",
    actions: [
      "Review the latest operational snapshot.",
      "Highlight any notable deviations.",
      "Escalate if the issue persists or worsens.",
    ],
  };
}
