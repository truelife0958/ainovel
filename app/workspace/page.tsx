import { AppShell } from "@/components/app-shell";
import { CreativeWorkspace } from "@/components/creative-workspace";
import { WorkspaceIntro } from "@/components/workspace-intro";
import { getCurrentProjectSummary } from "@/lib/projects/discovery.js";
import { readProviderConfigSummary } from "@/lib/settings/provider-config.js";
import { createProviderRuntimeStatus } from "@/lib/settings/provider-config.js";
import { listProjectDocuments } from "@/lib/projects/documents.js";
import { readProjectDocument } from "@/lib/projects/documents.js";
import { readChapterBrief } from "@/lib/projects/briefs.js";
import { buildChapterContext } from "@/lib/projects/context.js";

type WorkspacePageProps = {
  searchParams?: Promise<{
    file?: string | string[];
    type?: string | string[];
    assistantRequest?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  try {
    const params = searchParams ? await searchParams : undefined;

    const [project, providerConfig] = await Promise.all([
      getCurrentProjectSummary(),
      readProviderConfigSummary(),
    ]);

    const assistantStatus = createProviderRuntimeStatus(providerConfig, "writing");

    if (!project) {
      return (
        <AppShell
          currentPath="/workspace"
          project={null}
          title="创作"
          description="设定、大纲与章节写作的统一工作台。"
        >
          <section className="workspace-panel">
            <WorkspaceIntro
              eyebrow="创作工作台"
              title="当前没有活动项目"
              description="请先在项目页创建或选择一个项目。"
            />
          </section>
        </AppShell>
      );
    }

    const documents = await listProjectDocuments(project.root, "chapter");
    const settingDocs = await listProjectDocuments(project.root, "setting");
    const outlineDocs = await listProjectDocuments(project.root, "outline");

    const requestedFile = firstValue(params?.file);
    const requestedType = firstValue(params?.type) || "chapter";

    const selectedDocs =
      requestedType === "setting" ? settingDocs :
      requestedType === "outline" ? outlineDocs :
      documents;

    const selectedMeta =
      requestedFile && selectedDocs.some((item) => item.fileName === requestedFile)
        ? selectedDocs.find((item) => item.fileName === requestedFile) || selectedDocs[0]
        : selectedDocs[0];

    const [initialDocument, initialBrief, initialContext] = selectedMeta
      ? await Promise.all([
          readProjectDocument(project.root, requestedType as "chapter" | "setting" | "outline", selectedMeta.fileName),
          requestedType === "chapter" ? readChapterBrief(project.root, selectedMeta.fileName) : Promise.resolve(null),
          requestedType === "chapter" ? buildChapterContext(project.root, selectedMeta.fileName) : Promise.resolve(null),
        ])
      : [null, null, null];

    const initialAssistantRequest = firstValue(params?.assistantRequest);

    return (
      <AppShell
        currentPath="/workspace"
        project={project}
        title="创作"
        description="设定、大纲与章节写作的统一工作台。"
      >
        <CreativeWorkspace
          project={project}
          assistantStatus={assistantStatus}
          settings={settingDocs}
          outlines={outlineDocs}
          chapters={documents}
          initialDocument={initialDocument}
          initialBrief={initialBrief}
          initialContext={initialContext}
          initialAssistantRequest={initialAssistantRequest}
          initialType={requestedType as "chapter" | "setting" | "outline"}
        />
      </AppShell>
    );
  } catch (error) {
    return (
      <AppShell currentPath="/workspace" project={null} description="" title="创作">
        <div className="workspace-panel">
          <p style={{ color: "var(--color-error, #dc2626)" }}>
            加载创作工作台数据时出错，请稍后重试。
          </p>
        </div>
      </AppShell>
    );
  }
}
