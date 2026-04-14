"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  buildChapterRepairAdvice,
  buildChapterRepairRecommendation,
  buildChapterRepairRequest,
} from "@/lib/ai/repair-request.js";
import { EmptyState } from "@/components/empty-state";
import { evaluateChapterWriteGuard } from "@/lib/ai/write-guard.js";
import { parseChapterBriefContent, validateChapterBrief } from "@/lib/projects/brief-format.js";
import {
  buildWritingAssistantFocus,
  buildWritingContextFocus,
} from "@/lib/writing/focus.js";
import type { ChapterBrief, ChapterBriefValidation, ParsedChapterBrief } from "@/types/briefs";
import type { DocumentAiResult } from "@/types/ai";
import type { ChapterContext } from "@/types/context";
import type { ProjectDocument, ProjectDocumentMeta, ProjectDocumentKind } from "@/types/documents";
import type { ProjectSummary } from "@/types/project";
import type { ProviderRuntimeStatus } from "@/types/settings";

type AssetNodeType = "setting" | "outline" | "chapter";

type AssetNode = {
  type: AssetNodeType;
  meta: ProjectDocumentMeta;
};

type CreativeWorkspaceProps = {
  project: ProjectSummary | null;
  assistantStatus: ProviderRuntimeStatus;
  settings: ProjectDocumentMeta[];
  outlines: ProjectDocumentMeta[];
  chapters: ProjectDocumentMeta[];
  initialDocument: ProjectDocument | null;
  initialBrief: ChapterBrief | null;
  initialContext: ChapterContext | null;
  initialAssistantRequest?: string;
  initialType: AssetNodeType;
};

function aiValidationMessage(result: DocumentAiResult) {
  const validation = result.briefValidation;
  const repairAdvice = buildChapterRepairAdvice(validation);
  if (!validation) {
    return `已使用 ${result.provider} / ${result.model} 执行 ${result.target === "brief" ? "chapter_plan" : "chapter_write"}`;
  }

  if (validation.missingFields.length > 0) {
    return `已生成内容，但任务书仍缺 ${validation.missingFields.length} 项：${validation.missingFields.slice(0, 3).join("、")}。${repairAdvice}`;
  }

  if (validation.warnings.length > 0) {
    return `已生成内容，任务书有 ${validation.warnings.length} 条结构提醒。${repairAdvice}`;
  }

  return `已使用 ${result.provider} / ${result.model} 执行 ${result.target === "brief" ? "chapter_plan" : "chapter_write"}，任务书结构通过`;
}

function isRepairAction(
  action: ReturnType<typeof buildChapterRepairRequest> | NonNullable<ReturnType<typeof buildChapterRepairRecommendation>["primaryAction"]>,
): action is NonNullable<ReturnType<typeof buildChapterRepairRecommendation>["primaryAction"]> {
  return Boolean(action);
}

function typeLabel(type: AssetNodeType): string {
  switch (type) {
    case "setting": return "设定";
    case "outline": return "大纲";
    case "chapter": return "章节";
  }
}

export function CreativeWorkspace({
  project,
  assistantStatus,
  settings,
  outlines,
  chapters,
  initialDocument,
  initialBrief,
  initialContext,
  initialAssistantRequest,
  initialType,
}: CreativeWorkspaceProps) {
  const [selectedType, setSelectedType] = useState<AssetNodeType>(initialType);
  const [chapterDocs, setChapterDocs] = useState(chapters);
  const [settingDocs] = useState(settings);
  const [outlineDocs] = useState(outlines);
  const [selectedDocument, setSelectedDocument] = useState<ProjectDocument | null>(initialDocument);
  const [chapterContent, setChapterContent] = useState(initialDocument?.content ?? "");
  const [assetContent, setAssetContent] = useState("");
  const [brief, setBrief] = useState<ChapterBrief | null>(initialBrief);
  const [briefContent, setBriefContent] = useState(initialBrief?.content ?? "");
  const [context, setContext] = useState<ChapterContext | null>(initialContext);
  const [newTitle, setNewTitle] = useState("");
  const [assistantRequest, setAssistantRequest] = useState(initialAssistantRequest ?? "");
  const [selectedSecondaryRepair, setSelectedSecondaryRepair] = useState("");
  const [message, setMessage] = useState("");
  const [writeGuardArmed, setWriteGuardArmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isPendingRef = useRef(false);
  const hasAppliedInitialAssistantRequest = useRef(false);

  const currentDocs = selectedType === "setting" ? settingDocs :
    selectedType === "outline" ? outlineDocs : chapterDocs;

  const parsedBrief: ParsedChapterBrief = parseChapterBriefContent(briefContent);
  const briefValidation: ChapterBriefValidation = validateChapterBrief(parsedBrief);
  const writeGuard = evaluateChapterWriteGuard(briefValidation);
  const repairRequest = buildChapterRepairRequest(briefValidation);
  const repairRecommendation = buildChapterRepairRecommendation(briefValidation);
  const selectedDocumentFile = selectedDocument?.fileName ?? "";
  const hasSelectedDocument = Boolean(selectedDocument);
  const assistantAvailable = assistantStatus.available;

  const briefPreviewItems = [
    { label: "目标", value: parsedBrief.goal },
    { label: "阻力", value: parsedBrief.obstacle },
    { label: "代价", value: parsedBrief.cost },
    { label: "爽点", value: parsedBrief.rawCoolpoint },
    { label: "Strand", value: parsedBrief.strand },
    { label: "反派层级", value: parsedBrief.antagonistTier },
    { label: "视角/主角", value: parsedBrief.pov },
    { label: "关键实体", value: parsedBrief.keyEntities.join(" / ") },
    { label: "本章变化", value: parsedBrief.change },
    { label: "章末钩子", value: parsedBrief.hook || parsedBrief.rawHook },
    { label: "未闭合问题", value: parsedBrief.endQuestion },
  ];
  const requiredFieldCount = 11;
  const completedFieldCount = requiredFieldCount - briefValidation.missingFields.length;
  const summaryDetails = [
    `爽点模式：${parsedBrief.coolpointPatterns.join(" / ") || "未识别"}`,
    `主要冲突：${parsedBrief.conflict || "未填写"}`,
    `承接上章：${parsedBrief.carry || "未填写"}`,
    `钩子类型：${parsedBrief.hookType || "未填写"}`,
  ];
  const structuralSummary = `${completedFieldCount} / ${requiredFieldCount} 项已补齐`;
  const assistantFocus = buildWritingAssistantFocus({
    recommendationSummary: repairRecommendation.summary,
    assistantMessage: assistantStatus.message,
    statusMessage: message,
    projectTitle: project?.title ?? "",
    documentCount: chapterDocs.length,
  });
  const contextFocus = buildWritingContextFocus(context);
  const secondaryRepairActions = [
    repairRequest,
    ...repairRecommendation.secondaryActions,
  ].filter((action, index, array) => {
    if (!isRepairAction(action)) {
      return false;
    }
    const key = action.key || action.label;
    return array.findIndex((item) => (item?.key || item?.label) === key) === index;
  }).filter(isRepairAction);

  useEffect(() => {
    setChapterContent(selectedDocument?.content ?? "");
  }, [selectedDocument]);

  useEffect(() => {
    setBriefContent(brief?.content ?? "");
  }, [brief]);

  useEffect(() => {
    setWriteGuardArmed(false);
  }, [selectedDocument?.fileName, briefContent]);

  useEffect(() => {
    if (!selectedDocumentFile) {
      setAssistantRequest("");
      hasAppliedInitialAssistantRequest.current = false;
      return;
    }

    const isInitialLinkedChapter =
      Boolean(initialAssistantRequest) &&
      selectedDocumentFile === initialDocument?.fileName;

    if (isInitialLinkedChapter && !hasAppliedInitialAssistantRequest.current) {
      setAssistantRequest(initialAssistantRequest ?? "");
      hasAppliedInitialAssistantRequest.current = true;
      return;
    }

    if (!isInitialLinkedChapter) {
      setAssistantRequest("");
    }
  }, [initialAssistantRequest, initialDocument?.fileName, selectedDocumentFile]);

  const secondaryActionsKey = useMemo(
    () => secondaryRepairActions.map((a) => a.key || a.label).join("|"),
    [secondaryRepairActions],
  );

  useEffect(() => {
    setSelectedSecondaryRepair(secondaryRepairActions[0]?.request || "");
  }, [selectedDocumentFile, secondaryActionsKey]);

  const briefDirty = briefContent !== (brief?.content ?? "");
  const chapterDirty = chapterContent !== (selectedDocument?.content ?? "");

  const saveChapterRef = useRef(saveChapter);
  saveChapterRef.current = saveChapter;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        if (hasSelectedDocument && !isPendingRef.current) {
          saveChapterRef.current();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hasSelectedDocument]);

  const chapterWordCount = chapterContent.length;

  function startAction(fn: () => Promise<void>) {
    isPendingRef.current = true;
    startTransition(async () => {
      try {
        await fn();
      } finally {
        isPendingRef.current = false;
      }
    });
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const kind: ProjectDocumentKind = selectedType === "chapter" ? "chapter" : selectedType;

    startTransition(async () => {
      try {
        const response = await fetch("/api/projects/current/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, title: newTitle }),
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          setMessage(payload.error || `创建${typeLabel(selectedType)}失败`);
          return;
        }

        const fileName = payload.data.document.fileName;

        if (selectedType === "chapter") {
          const [briefResponse, contextResponse] = await Promise.all([
            fetch(`/api/projects/current/briefs?file=${encodeURIComponent(fileName)}`),
            fetch(`/api/projects/current/context?file=${encodeURIComponent(fileName)}`),
          ]);
          const briefPayload = await briefResponse.json();
          const contextPayload = await contextResponse.json();

          setChapterDocs(payload.data.documents);
          setSelectedDocument(payload.data.document);
          setBrief(briefResponse.ok && briefPayload.ok ? briefPayload.data : null);
          setContext(contextResponse.ok && contextPayload.ok ? contextPayload.data : null);
        } else {
          setSelectedDocument(payload.data.document);
          setAssetContent(payload.data.document.content);
        }

        setNewTitle("");
        setMessage(`已创建《${payload.data.document.title}》`);
      } catch {
        setMessage(`网络错误，创建${typeLabel(selectedType)}失败，请检查连接后重试。`);
      }
    });
  }

  function selectNode(type: AssetNodeType, fileName: string) {
    if (selectedType === type && selectedDocument?.fileName === fileName) {
      return;
    }

    setSelectedType(type);
    setMessage("");

    if (type === "chapter") {
      startTransition(async () => {
        try {
          const [documentResponse, briefResponse, contextResponse] = await Promise.all([
            fetch(`/api/projects/current/documents?kind=chapter&file=${encodeURIComponent(fileName)}`),
            fetch(`/api/projects/current/briefs?file=${encodeURIComponent(fileName)}`),
            fetch(`/api/projects/current/context?file=${encodeURIComponent(fileName)}`),
          ]);
          const documentPayload = await documentResponse.json();
          const briefPayload = await briefResponse.json();
          const contextPayload = await contextResponse.json();

          if (!documentResponse.ok || !documentPayload.ok) {
            setMessage(documentPayload.error || "读取章节失败");
            return;
          }
          if (!briefResponse.ok || !briefPayload.ok) {
            setMessage(briefPayload.error || "读取任务书失败");
            return;
          }
          if (!contextResponse.ok || !contextPayload.ok) {
            setMessage(contextPayload.error || "读取章节上下文失败");
            return;
          }

          setSelectedDocument(documentPayload.data);
          setBrief(briefPayload.data);
          setContext(contextPayload.data);
        } catch {
          setMessage("网络错误，切换章节失败，请重试。");
        }
      });
    } else {
      startTransition(async () => {
        try {
          const response = await fetch(
            `/api/projects/current/documents?kind=${type}&file=${encodeURIComponent(fileName)}`,
          );
          const payload = await response.json();

          if (!response.ok || !payload.ok) {
            setMessage(payload.error || `读取${typeLabel(type)}失败`);
            return;
          }

          setSelectedDocument(payload.data);
          setAssetContent(payload.data.content);
        } catch {
          setMessage(`网络错误，读取${typeLabel(type)}失败，请重试。`);
        }
      });
    }
  }

  function saveChapter() {
    if (!selectedDocument) return;

    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/projects/current/documents", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: selectedType === "chapter" ? "chapter" : selectedType,
            fileName: selectedDocument.fileName,
            content: selectedType === "chapter" ? chapterContent : assetContent,
          }),
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          setMessage(payload.error || "保存失败");
          return;
        }

        if (selectedType === "chapter") {
          setChapterDocs(payload.data.documents);
        }
        setSelectedDocument(payload.data.document);
        setMessage(`已保存《${payload.data.document.title}》`);
      } catch {
        setMessage("网络错误，保存失败，请重试。");
      }
    });
  }

  function saveBrief() {
    if (!selectedDocument) return;

    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/projects/current/briefs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: selectedDocument.fileName,
            content: briefContent,
          }),
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          setMessage(payload.error || "保存任务书失败");
          return;
        }

        setBrief(payload.data);
        setMessage(`已保存第 ${payload.data.chapterNumber} 章任务书`);
      } catch {
        setMessage("网络错误，保存任务书失败，请重试。");
      }
    });
  }

  function runAi(mode: "chapter_plan" | "chapter_write", overrideRequest?: string) {
    if (!selectedDocument) return;

    if (mode === "chapter_plan" && briefDirty) {
      setMessage("任务书有未保存的修改，请先保存后再规划。");
      return;
    }
    if (mode === "chapter_write" && chapterDirty) {
      setMessage("正文有未保存的修改，请先保存后再生成。");
      return;
    }

    if (mode === "chapter_write" && writeGuard.requiresConfirmation && !writeGuardArmed) {
      setWriteGuardArmed(true);
      setMessage(writeGuard.summary);
      return;
    }

    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/projects/current/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "chapter",
            fileName: selectedDocument.fileName,
            mode,
            userRequest: overrideRequest ?? assistantRequest,
            applyMode: mode === "chapter_plan" ? "replace" : "append",
          }),
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          setMessage(payload.error || "AI 动作执行失败");
          return;
        }

        if (payload.data.target === "brief") {
          setBrief(payload.data.document);
          setBriefContent(payload.data.document.content);
          setWriteGuardArmed(false);
        } else {
          setSelectedDocument(payload.data.document);
          setChapterContent(payload.data.document.content);
          setChapterDocs(payload.data.documents);
          setWriteGuardArmed(false);
        }

        const contextResponse = await fetch(
          `/api/projects/current/context?file=${encodeURIComponent(selectedDocument.fileName)}`,
        );
        const contextPayload = await contextResponse.json();
        if (contextResponse.ok && contextPayload.ok) {
          setContext(contextPayload.data);
        }

        setMessage(aiValidationMessage(payload.data as DocumentAiResult));
      } catch {
        setMessage("网络错误，AI 动作执行失败，请重试。");
      }
    });
  }

  function runRepairPlan(request = repairRequest?.request || "") {
    if (!request) return;
    setAssistantRequest(request);
    setWriteGuardArmed(false);
    runAi("chapter_plan", request);
  }

  return (
    <div className="creative-workspace-grid">
      {/* Left: Asset Tree */}
      <aside className="workspace-asset-tree">
        <div className="asset-tree-section">
          <p className="eyebrow">设定</p>
          <div className="document-list compact">
            {settingDocs.length ? (
              settingDocs.map((doc) => (
                <button
                  key={doc.fileName}
                  type="button"
                  className={selectedType === "setting" && selectedDocument?.fileName === doc.fileName ? "document-item active" : "document-item"}
                  onClick={() => selectNode("setting", doc.fileName)}
                  disabled={isPending}
                >
                  <strong>{doc.title}</strong>
                </button>
              ))
            ) : (
              <p className="muted">暂无设定</p>
            )}
          </div>
        </div>
        <div className="asset-tree-section">
          <p className="eyebrow">大纲</p>
          <div className="document-list compact">
            {outlineDocs.length ? (
              outlineDocs.map((doc) => (
                <button
                  key={doc.fileName}
                  type="button"
                  className={selectedType === "outline" && selectedDocument?.fileName === doc.fileName ? "document-item active" : "document-item"}
                  onClick={() => selectNode("outline", doc.fileName)}
                  disabled={isPending}
                >
                  <strong>{doc.title}</strong>
                </button>
              ))
            ) : (
              <p className="muted">暂无大纲</p>
            )}
          </div>
        </div>
        <div className="asset-tree-section">
          <p className="eyebrow">章节</p>
          <form className="create-row" onSubmit={handleCreate}>
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder={`新建${typeLabel(selectedType)}`}
            />
            <button type="submit" className="action-button compact" disabled={isPending || !newTitle.trim()}>
              新建
            </button>
          </form>
          <div className="document-list compact">
            {chapterDocs.length ? (
              chapterDocs.map((doc) => (
                <button
                  key={doc.fileName}
                  type="button"
                  className={selectedType === "chapter" && selectedDocument?.fileName === doc.fileName ? "document-item active" : "document-item"}
                  onClick={() => selectNode("chapter", doc.fileName)}
                  disabled={isPending}
                >
                  <strong>{doc.title}</strong>
                  <span>{doc.preview || "空白章节"}</span>
                </button>
              ))
            ) : (
              <p className="muted">暂无章节</p>
            )}
          </div>
        </div>
      </aside>

      {/* Center: Main Editor */}
      <div className="workspace-main-editor">
        {selectedType === "chapter" && hasSelectedDocument ? (
          <>
            {/* Chapter Brief */}
            <section className="editor-card">
              <div className="editor-toolbar">
                <div>
                  <p className="eyebrow">章节任务书</p>
                  <strong>{brief?.title ?? "未选择章节"}</strong>
                </div>
                <button
                  type="button"
                  className="action-button secondary"
                  disabled={isPending || !hasSelectedDocument}
                  onClick={saveBrief}
                >
                  保存任务书
                </button>
              </div>
              <textarea
                className="editor-area compact-area"
                value={briefContent}
                onChange={(event) => setBriefContent(event.target.value)}
                spellCheck={false}
                placeholder={`### 第 N 章：标题\n- 目标:\n- 阻力:\n- 代价:\n- 爽点:\n- Strand:\n- 反派层级:\n- 视角/主角:\n- 关键实体:\n- 本章变化:\n- 章末未闭合问题:\n- 钩子:`}
              />
              <div className="context-grid compact-grid">
                <div className="list-card inner-card">
                  <p className="eyebrow">任务书速览</p>
                  <ul>
                    {briefPreviewItems.map((item) => (
                      <li key={item.label}>
                        {item.label}：{item.value || "未填写"}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="list-card inner-card">
                  <p className="eyebrow">结构诊断</p>
                  <div className="diagnostic-stack">
                    <p className="muted">{structuralSummary}</p>
                    <div className="summary-pill-row">
                      {summaryDetails.map((item) => (
                        <span key={item} className="summary-pill">{item}</span>
                      ))}
                    </div>
                    {briefValidation.missingFields.length ? (
                      <ul className="warning-list">
                        {briefValidation.missingFields.map((field) => (
                          <li key={field}>缺：{field}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">必填字段已补齐。</p>
                    )}
                    {briefValidation.warnings.length ? (
                      <ul className="warning-list">
                        {briefValidation.warnings.map((warning) => (
                          <li key={warning.code}>
                            <strong>{warning.severity === "high" ? "高风险" : "提醒"}</strong>：{warning.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {/* Chapter Text */}
            <section className="editor-card">
              <div className="editor-toolbar">
                <div>
                  <p className="eyebrow">正文编辑器</p>
                  <strong>{selectedDocument?.title ?? "未选择章节"}</strong>
                </div>
                <button
                  type="button"
                  className="action-button"
                  disabled={isPending || !hasSelectedDocument}
                  onClick={saveChapter}
                >
                  保存正文
                </button>
              </div>
              <textarea
                className="editor-area"
                value={chapterContent}
                onChange={(event) => setChapterContent(event.target.value)}
                spellCheck={false}
              />
              <p className="muted" style={{ fontSize: "13px", marginTop: "4px" }}>
                {chapterWordCount} 字
              </p>
            </section>
          </>
        ) : selectedType !== "chapter" && hasSelectedDocument ? (
          /* Setting / Outline Editor */
          <section className="editor-card">
            <div className="editor-toolbar">
              <div>
                <p className="eyebrow">{typeLabel(selectedType)}编辑器</p>
                <strong>{selectedDocument?.title ?? `未选择${typeLabel(selectedType)}`}</strong>
              </div>
              <button
                type="button"
                className="action-button"
                disabled={isPending || !hasSelectedDocument}
                onClick={saveChapter}
              >
                保存
              </button>
            </div>
            <textarea
              className="editor-area"
              value={assetContent}
              onChange={(event) => setAssetContent(event.target.value)}
              spellCheck={false}
            />
          </section>
        ) : (
          <EmptyState message={`在左侧选择或创建${typeLabel(selectedType)}，开始编辑。`} />
        )}
      </div>

      {/* Right: AI Assistant */}
      <aside className="workspace-ai-assistant">
        {selectedType === "chapter" && hasSelectedDocument ? (
          <>
            <div className="ai-assistant-status">
              <span className={`connection-dot ${assistantAvailable ? "connected" : "disconnected"}`} />
              <span className="muted">{assistantAvailable ? "AI 已就绪" : "AI 未就绪"}</span>
            </div>

            <section className="editor-card compact">
              <div className="editor-toolbar">
                <p className="eyebrow">AI 助手</p>
                <strong>{selectedDocument?.title ?? "未选择章节"}</strong>
              </div>
              <textarea
                rows={3}
                value={assistantRequest}
                onChange={(event) => setAssistantRequest(event.target.value)}
                placeholder={
                  !assistantAvailable
                    ? "请先在连接页完成 AI 接入。"
                    : hasSelectedDocument
                    ? "补充本次规划或修补意图。"
                    : "选择章节后可使用 AI。"
                }
                disabled={!hasSelectedDocument || !assistantAvailable}
              />
              <div className="assistant-actions">
                <button
                  type="button"
                  className="action-button"
                  disabled={isPending || !hasSelectedDocument || !assistantAvailable}
                  onClick={() => runAi("chapter_plan")}
                >
                  AI 规划本章
                </button>
                {repairRecommendation.primaryAction ? (
                  <button
                    key={repairRecommendation.primaryAction.key || repairRecommendation.primaryAction.label}
                    type="button"
                    className="action-button secondary"
                    disabled={isPending || !hasSelectedDocument || !assistantAvailable}
                    onClick={() => runRepairPlan(repairRecommendation.primaryAction?.request)}
                  >
                    推荐：{repairRecommendation.primaryAction.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="action-button secondary"
                  disabled={isPending || !hasSelectedDocument || !assistantAvailable}
                  onClick={() => runAi("chapter_write")}
                >
                  {writeGuardArmed && writeGuard.requiresConfirmation ? writeGuard.buttonLabel : "AI 生成正文"}
                </button>
              </div>
              {secondaryRepairActions.length ? (
                <div className="assistant-secondary-row">
                  <select
                    value={selectedSecondaryRepair}
                    onChange={(event) => setSelectedSecondaryRepair(event.target.value)}
                    disabled={isPending || !hasSelectedDocument || !assistantAvailable}
                  >
                    {secondaryRepairActions.map((action) => (
                      <option key={action.key || action.label} value={action.request}>
                        {action.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="action-button secondary"
                    disabled={isPending || !hasSelectedDocument || !assistantAvailable || !selectedSecondaryRepair}
                    onClick={() => runRepairPlan(selectedSecondaryRepair)}
                  >
                    执行修补
                  </button>
                </div>
              ) : null}
              <div className="assistant-notes" aria-live="polite">
                {assistantFocus.notes.length ? (
                  assistantFocus.notes.map((note) => (
                    <p key={note} className="muted">{note}</p>
                  ))
                ) : (
                  <p className="muted">{assistantFocus.fallback}</p>
                )}
              </div>
            </section>

            {/* Context Panel */}
            <section className="editor-card compact">
              <div className="editor-toolbar">
                <p className="eyebrow">章节上下文</p>
                <strong>第 {context?.chapterNumber ?? 0} 章</strong>
              </div>
              {hasSelectedDocument ? (
                <div className="context-grid compact-grid">
                  <div className="list-card inner-card">
                    <p className="eyebrow">本章大纲</p>
                    <p className="muted context-pre">{contextFocus.outlineText}</p>
                  </div>
                  <div className="list-card inner-card">
                    <p className="eyebrow">前文摘要</p>
                    <p className="muted context-pre">{contextFocus.previousSummaryText}</p>
                  </div>
                  <div className="list-card inner-card">
                    <p className="eyebrow">状态摘要</p>
                    <p className="muted context-pre">{contextFocus.stateSummaryText}</p>
                  </div>
                  <div className="list-card inner-card">
                    <p className="eyebrow">执行建议</p>
                    <ul>
                      {contextFocus.guidanceItems.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </div>
              ) : (
                <EmptyState message="选择章节后展示上下文。" />
              )}
            </section>
          </>
        ) : selectedType !== "chapter" && hasSelectedDocument ? (
          <>
            <div className="ai-assistant-status">
              <span className={`connection-dot ${assistantAvailable ? "connected" : "disconnected"}`} />
              <span className="muted">{assistantAvailable ? "AI 已就绪" : "AI 未就绪"}</span>
            </div>
            <section className="editor-card compact">
              <div className="editor-toolbar">
                <p className="eyebrow">AI 助手</p>
                <strong>{typeLabel(selectedType)}</strong>
              </div>
              <div className="assistant-actions">
                {selectedType === "setting" && (
                  <>
                    <button type="button" className="action-button" disabled={!assistantAvailable || isPending}>补全设定</button>
                    <button type="button" className="action-button secondary" disabled={!assistantAvailable || isPending}>提炼设定</button>
                    <button type="button" className="action-button secondary" disabled={!assistantAvailable || isPending}>重组设定</button>
                  </>
                )}
                {selectedType === "outline" && (
                  <>
                    <button type="button" className="action-button" disabled={!assistantAvailable || isPending}>扩写大纲</button>
                    <button type="button" className="action-button secondary" disabled={!assistantAvailable || isPending}>细化节拍</button>
                    <button type="button" className="action-button secondary" disabled={!assistantAvailable || isPending}>补下一层</button>
                  </>
                )}
              </div>
            </section>
          </>
        ) : (
          <EmptyState message="选择内容后，AI 助手将根据类型提供对应动作。" />
        )}
      </aside>
    </div>
  );
}
