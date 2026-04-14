import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricGrid } from "@/components/metric-grid";
import { ReviewIssueList } from "@/components/review-issue-list";
import { WorkspaceIntro } from "@/components/workspace-intro";
import { getCurrentProjectSummary } from "@/lib/projects/discovery.js";
import { readProjectReviewSummary } from "@/lib/projects/review.js";

export default async function ReviewPage() {
  try {
    const project = await getCurrentProjectSummary();
    const summary = project ? await readProjectReviewSummary(project.root) : null;

    return (
      <AppShell
        currentPath="/review"
        project={project}
        title="审查"
        description="发现的问题、风险与修复入口。"
      >
        {summary ? (
          <>
            <MetricGrid
              metrics={[
                { label: "风险提醒", value: `${summary.warningCount}`, hint: "需要关注的问题" },
                { label: "待处理", value: `${summary.pendingCount}`, hint: "尚未处理的条目" },
                { label: "失败任务", value: `${summary.failedTasks}`, hint: "需要回看的环节" },
                { label: "审查检查点", value: `${summary.reviewCheckpointCount}`, hint: "已完成审查次数" },
              ]}
            />
            <section className="workspace-panel">
              <WorkspaceIntro
                eyebrow="问题中心"
                title="发现问题，送回创作修补"
                description="审查不是第二个编辑器，只负责告诉你问题在哪、为什么是问题、去哪里修。"
              />
              <ReviewIssueList summary={summary} />
            </section>
          </>
        ) : (
          <section className="workspace-panel">
            <WorkspaceIntro
              eyebrow="问题中心"
              title="当前没有活动项目"
              description="没有活动项目时无法读取审查结果。"
            />
            <EmptyState variant="card" message="请先创建或选择项目。" />
          </section>
        )}
      </AppShell>
    );
  } catch (error) {
    return (
      <AppShell currentPath="/review" project={null} description="" title="审查">
        <div className="workspace-panel">
          <p style={{ color: "var(--color-error, #dc2626)" }}>
            加载审查数据时出错，请稍后重试。
          </p>
        </div>
      </AppShell>
    );
  }
}
