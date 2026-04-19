"use client";

import { Modal } from "@/components/ui/modal";
import { MetricGrid } from "@/components/metric-grid";
import { ReviewIssueList } from "@/components/review-issue-list";
import { useModalResource } from "@/lib/api/use-modal-resource";
import type { ReviewSummary } from "@/types/review";

type ReviewModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ReviewModal({ open, onClose }: ReviewModalProps) {
  const { data: summary, loading, error, retry } = useModalResource<ReviewSummary>(
    "/api/projects/current/review",
    open,
  );

  const metrics = summary
    ? [
        { label: "风险提醒", value: String(summary.warningCount ?? 0), hint: "需要关注的问题" },
        { label: "待处理", value: String(summary.pendingCount ?? 0), hint: "尚未处理的条目" },
        { label: "失败任务", value: String(summary.failedTasks ?? 0), hint: "需要回看的环节" },
        { label: "审查检查点", value: String(summary.reviewCheckpointCount ?? 0), hint: "已完成审查次数" },
      ]
    : [];

  return (
    <Modal open={open} onClose={onClose} title="审查" eyebrow="问题中心与修复入口" variant="standard">
      {loading ? (
        <div className="modal-loading">
          <span className="ai-spinner" />{" "}
          <p className="muted">加载中…</p>
        </div>
      ) : error ? (
        <div className="modal-loading">
          <p className="modal-error">无法加载审查数据。</p>
          <button type="button" className="action-button compact" onClick={retry}>重试</button>
        </div>
      ) : summary ? (
        <>
          <MetricGrid metrics={metrics} />
          <div className="modal-section">
            <ReviewIssueList summary={summary} />
          </div>
        </>
      ) : null}
    </Modal>
  );
}
