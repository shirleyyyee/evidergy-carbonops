import assert from "node:assert/strict";
import test from "node:test";
import { createAgentPlan, type AgentTask } from "../lib/agent.ts";

test("creates an investigation plan for alert-style prompts", () => {
  const task: AgentTask = {
    prompt: "Investigate the PV anomaly alert at the site before the next shift.",
    context: ["site:demo-site", "asset:pv-array-01"],
  };

  const plan = createAgentPlan(task);

  assert.equal(plan.intent, "investigate");
  assert.equal(plan.priority, "high");
  assert.ok(plan.actions.some((action) => action.includes("evidence")));
  assert.ok(plan.summary.includes("PV"));
});

test("creates a reporting plan for carbon and forecast prompts", () => {
  const task: AgentTask = {
    prompt: "Prepare the monthly carbon ledger and forecast export for operations review.",
  };

  const plan = createAgentPlan(task);

  assert.equal(plan.intent, "report");
  assert.equal(plan.priority, "medium");
  assert.ok(plan.actions.some((action) => action.includes("carbon")));
});
