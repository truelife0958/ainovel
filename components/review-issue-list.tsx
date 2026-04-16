"use client";

import Link from "next/link";

import { buildReviewFocus } from "@/lib/review/focus.js";
import type { ReviewSummary } from "@/types/review";

type ReviewIssueListProps = {
  summary: ReviewSummary;
};

export function ReviewIssueList({ summary }: ReviewIssueListProps) {
  const focus = buildReviewFocus(summary);

  const issues: Array<{
    id: string;
    severity: "warning" | "info";
    category: string;
    message: string;
    suggestion: string;
    actionHref: string | null;
  }> = [];

  // Build issues from review data
  if (summary.warningCount > 0) {
    issues.push({
      id: "warnings",
      severity: "warning",
      category: "风险提醒",
      message: `发现 ${summary.warningCount} 条待消歧告警，可能影响后续章节一致性。`,
      suggestion: "逐一检查告警内容，确认是否需要修补设定或正文。",
      actionHref: focus.actionHref,
    });
  }

  if (summary.pendingCount > 0) {
    issues.push({
      id: "pending",
      severity: "warning",
      category: "待处理条目",
      message: `${summary.pendingCount} 条待处理数据尚未确认。`,
      suggestion: "在创作台完成相关章节的确认与修补。",
      actionHref: focus.actionHref,
    });
  }

  if (summary.failedTasks > 0) {
    issues.push({
      id: "failed",
      severity: "warning",
      category: "执行失败",
      message: `${summary.failedTasks} 次任务执行失败，可能影响创作链路完整性。`,
      suggestion: "检查 AI 连接状态，在创作台重试对应章节的操作。",
      actionHref: focus.actionHref,
    });
  }

  if (focus.emptyMessage === "" && focus.recommendationLabel !== "暂无") {
    issues.push({
      id: "repair",
      severity: "info",
      category: "修补建议",
      message: focus.summaryText,
      suggestion: focus.recommendationLabel,
      actionHref: focus.actionHref,
    });
  }

  if (issues.length === 0) {
    return (
      <div className="review-issues-empty">
        <p className="muted">当前没有需要关注的问题。</p>
        <p className="muted">继续在创作台推进章节，审查结果会自动更新。</p>
      </div>
    );
  }

  return (
    <div className="review-issue-list">
      {issues.map((issue) => (
        <article key={issue.id} className={`review-issue-card ${issue.severity}`}>
          <div className="review-issue-head">
            <span className={`severity-badge ${issue.severity}`}>
              {issue.severity === "warning" ? "需关注" : "建议"}
            </span>
            <strong>{issue.category}</strong>
          </div>
          <div className="review-issue-body">
            <p>{issue.message}</p>
            <p className="muted">建议：{issue.suggestion}</p>
          </div>
          <div className="review-issue-actions">
            {issue.actionHref ? (
              <Link href={issue.actionHref} className="action-button secondary">
                去创作台修补
              </Link>
            ) : (
              <Link href="/" className="action-button secondary">
                进入创作台
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
