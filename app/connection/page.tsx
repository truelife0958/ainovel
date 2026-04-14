import { AppShell } from "@/components/app-shell";
import { ConnectionWizard } from "@/components/connection-wizard";
import { WorkspaceIntro } from "@/components/workspace-intro";
import { getCurrentProjectSummary } from "@/lib/projects/discovery.js";
import { readProviderConfigSummary } from "@/lib/settings/provider-config.js";

export default async function ConnectionPage() {
  try {
    const [project, config] = await Promise.all([
      getCurrentProjectSummary(),
      readProviderConfigSummary(),
    ]);

    return (
      <AppShell
        currentPath="/connection"
        project={project}
        title="连接"
        description="接入 AI 能力，开始创作。"
      >
        <section className="workspace-panel">
          <WorkspaceIntro
            eyebrow="AI 连接"
            title="先连 AI，再创作"
            description="完成连接后，AI 规划、写作、修补等能力将自动可用。"
          />
          <ConnectionWizard initialConfig={config} />
        </section>
      </AppShell>
    );
  } catch (error) {
    return (
      <AppShell currentPath="/connection" project={null} description="" title="连接">
        <div className="workspace-panel">
          <p style={{ color: "var(--color-error, #dc2626)" }}>
            加载连接配置时出错，请稍后重试。
          </p>
        </div>
      </AppShell>
    );
  }
}
