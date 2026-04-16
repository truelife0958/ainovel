import { AppShell, WelcomeShell } from "@/components/app-shell";
import { CreativeWorkspace } from "@/components/creative-workspace";
import { getCurrentProjectSummary } from "@/lib/projects/discovery.js";
import { readProviderConfigSummary, createProviderRuntimeStatus } from "@/lib/settings/provider-config.js";
import { listProjectDocuments, readProjectDocument } from "@/lib/projects/documents.js";
import { readChapterBrief } from "@/lib/projects/briefs.js";
import { buildChapterContext } from "@/lib/projects/context.js";

type HomePageProps = {
  searchParams?: Promise<{
    file?: string | string[];
    type?: string | string[];
    assistantRequest?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : undefined;

  const [project, providerConfig] = await Promise.all([
    getCurrentProjectSummary(),
    readProviderConfigSummary(),
  ]);

  const assistantStatus = createProviderRuntimeStatus(providerConfig, "writing");

  if (!project) {
    return <WelcomeShell aiAvailable={assistantStatus.available} />;
  }

  const [chapterDocs, settingDocs, outlineDocs] = await Promise.all([
    listProjectDocuments(project.root, "chapter"),
    listProjectDocuments(project.root, "setting"),
    listProjectDocuments(project.root, "outline"),
  ]);

  const requestedFile = firstValue(params?.file);
  const requestedType = firstValue(params?.type) || "chapter";

  const selectedDocs =
    requestedType === "setting" ? settingDocs :
    requestedType === "outline" ? outlineDocs :
    chapterDocs;

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
    <AppShell project={project} aiAvailable={assistantStatus.available}>
      <CreativeWorkspace
        project={project}
        assistantStatus={assistantStatus}
        settings={settingDocs}
        outlines={outlineDocs}
        chapters={chapterDocs}
        initialDocument={initialDocument}
        initialBrief={initialBrief}
        initialContext={initialContext}
        initialAssistantRequest={initialAssistantRequest}
        initialType={requestedType as "chapter" | "setting" | "outline"}
      />
    </AppShell>
  );
}
