import { formatSummary, formatIdeation, formatDocument } from "./_shared.js";

export function buildOutlinePrompt({ project, ideation, document, userRequest, guardrails, applyMode }) {
  const task =
    applyMode === "append"
      ? "Add a high-value continuation section that extends the current outline without rewriting earlier sections."
      : "Rewrite the outline so it becomes a stronger execution document while preserving the existing premise and major canon facts.";

  return [
    "# Task",
    task,
    "",
    "Prioritize conflict chains, escalation, payoff scheduling, scene-to-scene momentum, and chapter-end hooks.",
    "Keep the outline commercially sharp and practical for drafting.",
    userRequest ? `User Request: ${userRequest}` : "User Request: None",
    "",
    "# Project Summary",
    formatSummary(project),
    "",
    "# Ideation",
    formatIdeation(ideation),
    "",
    "# Originality Guardrails",
    guardrails,
    "",
    "# Current Outline Document",
    formatDocument(document),
    "",
    "# Output Requirements",
    "- Return Markdown only.",
    "- Preserve the project's own setting, cast, and premise.",
    "- Strengthen volume arcs, chapter beats, reversals, and payoff timing.",
    "- Make sure the next drafting step is more actionable after this output.",
  ].join("\n");
}
