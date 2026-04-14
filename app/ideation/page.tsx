import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { IdeationForm } from "@/components/ideation-form";
import { WorkspaceIntro } from "@/components/workspace-intro";
import { getCurrentProjectSummary } from "@/lib/projects/discovery.js";
import { readProjectIdeation } from "@/lib/projects/state.js";

export default async function IdeationPage() {
  try {
    const project = await getCurrentProjectSummary();
    const ideation = project ? await readProjectIdeation(project.root) : null;

    return (
      <AppShell
        currentPath="/ideation"
        project={project}
        title="立项"
        description="定义作品核心信息。"
      >
        <section className="workspace-panel">
          <WorkspaceIntro
            eyebrow="作品卡"
            title="定义作品核心，然后进入创作"
            description="先明确作品定位、目标读者和核心卖点，后续规划和写作都会复用这里的判断。"
          />
          {ideation ? (
            <IdeationForm initialIdeation={ideation} />
          ) : (
            <EmptyState variant="card" message="请先创建或切换到一个项目，再编辑立项信息。" />
          )}
        </section>
      </AppShell>
    );
  } catch (error) {
    return (
      <AppShell currentPath="/ideation" project={null} description="" title="立项">
        <div className="workspace-panel">
          <p style={{ color: "var(--color-error, #dc2626)" }}>
            加载立项数据时出错，请稍后重试。
          </p>
        </div>
      </AppShell>
    );
  }
}
