function compactLines(items) {
  return items.map((item) => String(item || "").trim()).filter(Boolean);
}

export function buildWritingAssistantFocus({
  recommendationSummary,
  assistantMessage,
  statusMessage,
  projectTitle,
  documentCount,
}) {
  const notes = compactLines([recommendationSummary, assistantMessage, statusMessage]);

  return {
    notes,
    fallback: notes.length ? "" : `当前项目：${projectTitle || "未检测到"}，章节数：${documentCount}`,
  };
}

export function buildWritingContextFocus(context) {
  const guidanceItems = compactLines(context?.guidanceItems || []);

  return {
    outlineText: String(context?.outline || "").trim() || "暂无大纲片段",
    previousSummaryText: compactLines(context?.previousSummaries || []).join("\n\n") || "暂无上章摘要",
    stateSummaryText: String(context?.stateSummary || "").trim() || "暂无状态摘要",
    guidanceItems: guidanceItems.length ? guidanceItems : ["暂无执行建议"],
  };
}
