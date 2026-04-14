import { AppShell } from "@/components/app-shell";
import { FocusBoard } from "@/components/focus-board";
import { MetricGrid } from "@/components/metric-grid";
import { ProjectWorkspacePanel } from "@/components/project-workspace-panel";
import { buildDashboardFocus } from "@/lib/dashboard/focus.js";
import { buildDashboardMetrics } from "@/lib/dashboard/metrics.js";
import { listProjectsWithCurrent } from "@/lib/projects/workspace.js";
import type { ProjectWorkspace } from "@/types/project";

export default async function ProjectsPage() {
  try {
    const workspace: ProjectWorkspace = await listProjectsWithCurrent();
    const project =
      workspace.projects.find((item) => item.id === workspace.currentProjectId) ??
      workspace.projects[0] ??
      null;
    const focus = buildDashboardFocus(project);
    const metrics = buildDashboardMetrics(project);

    return (
      <AppShell
        currentPath="/projects"
        project={project}
        title="项目"
        description="创建、切换与管理你的作品。"
      >
        <MetricGrid metrics={metrics} />
        <section className="workspace-panel">
          <FocusBoard
            eyebrow="项目访问"
            title="选择作品，开始创作"
            description="把项目切换、创建和当前状态收在一屏内，只保留真正影响下一步的信息。"
            highlights={focus.snapshot}
            sections={[
              { title: "推荐动作", items: focus.nextSteps },
              { title: "优先补位", items: focus.gaps },
            ]}
          />
          <ProjectWorkspacePanel initialWorkspace={workspace} />
        </section>
      </AppShell>
    );
  } catch (error) {
    return (
      <AppShell currentPath="/projects" project={null} description="" title="项目">
        <div className="workspace-panel">
          <p style={{ color: "var(--color-error, #dc2626)" }}>
            加载项目数据时出错，请稍后重试。
          </p>
        </div>
      </AppShell>
    );
  }
}
