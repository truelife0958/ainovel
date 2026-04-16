"use client";

import type { ChapterBrief, ChapterBriefValidation, ParsedChapterBrief } from "@/types/briefs";

type ChapterBriefEditorProps = {
  brief: ChapterBrief | null;
  briefContent: string;
  parsedBrief: ParsedChapterBrief;
  briefValidation: ChapterBriefValidation;
  disabled: boolean;
  onBriefContentChange: (value: string) => void;
  onSave: () => void;
};

export function ChapterBriefEditor({
  brief,
  briefContent,
  parsedBrief,
  briefValidation,
  disabled,
  onBriefContentChange,
  onSave,
}: ChapterBriefEditorProps) {
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

  return (
    <section className="editor-card">
      <div className="editor-toolbar">
        <div>
          <p className="eyebrow">章节任务书</p>
          <strong>{brief?.title ?? "未选择章节"}</strong>
        </div>
        <button
          type="button"
          className="action-button secondary"
          disabled={disabled}
          onClick={onSave}
        >
          保存任务书
        </button>
      </div>
      <textarea
        className="editor-area compact-area"
        value={briefContent}
        onChange={(event) => onBriefContentChange(event.target.value)}
        spellCheck={false}
        placeholder={`### 第 N 章：标题\n- 目标:\n- 阻力:\n- 代价:\n- 爽点:\n- Strand:\n- 反派层级:\n- 视角/主角:\n- 关键实体:\n- 本章变化:\n- 章末未闭合问题:\n- 钩子:`}
      />
      <div className="context-grid compact-grid">
        <div className="list-card inner-card">
          <p className="eyebrow">任务书速览</p>
          <ul>
            {briefPreviewItems.map((item) => (
              <li key={item.label}>
                {item.label}：{item.value || <span className="muted">未填写</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="list-card inner-card">
          <p className="eyebrow">结构诊断</p>
          <div className="diagnostic-stack">
            <p className="muted">{structuralSummary}</p>
            <div className="brief-progress">
              <div className={`brief-progress-bar${completedFieldCount === requiredFieldCount ? " complete" : ""}`} style={{ width: `${Math.round((completedFieldCount / requiredFieldCount) * 100)}%` }} />
            </div>
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
  );
}
