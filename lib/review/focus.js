import { buildWritingRepairHref } from "../ai/repair-link.js";

function pushIfPresent(items, label, value) {
  if (String(value || "").trim()) {
    items.push(`${label}：${String(value).trim()}`);
  }
}

export function buildReviewFocus(summary) {
  const latest = summary.latestChapterMeta;
  const latestRepair = summary.latestChapterRepair;

  if (!latest) {
    return {
      metaItems: [],
      detailItems: [],
      recommendationLabel: "暂无",
      summaryText: "无",
      secondaryLabels: [],
      actionHref: null,
      emptyMessage: "还没有可用的章节元数据。",
      followupMessage: "先去创作页完成任务书和正文，再回审查页看修补建议。",
    };
  }

  const metaItems = [`章节：第 ${latest.chapter} 章`];
  pushIfPresent(metaItems, "Strand", latest.strand);
  pushIfPresent(metaItems, "钩子类型", latest.hookType);
  if (latest.coolpointPatterns.length) {
    metaItems.push(`爽点模式：${latest.coolpointPatterns.join(" / ")}`);
  }

  const detailItems = [];
  if (String(latest.hook || "").trim()) {
    detailItems.push({ label: "章末钩子", value: latest.hook });
  }
  if (String(latest.endQuestion || "").trim()) {
    detailItems.push({ label: "未闭合问题", value: latest.endQuestion });
  }
  if (String(latest.change || "").trim()) {
    detailItems.push({ label: "本章变化", value: latest.change });
  }

  return {
    metaItems,
    detailItems,
    recommendationLabel: latestRepair.primaryAction?.label || "暂无",
    summaryText: latestRepair.summary || "无",
    secondaryLabels: latestRepair.secondaryActions.map((item) => item.label).filter(Boolean),
    actionHref: latestRepair.primaryAction
      ? buildWritingRepairHref(latest.chapter, latestRepair.primaryAction.request)
      : null,
    emptyMessage: "",
    followupMessage: "",
  };
}
