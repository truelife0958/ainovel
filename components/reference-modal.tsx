"use client";

import { useState, useTransition } from "react";

import { Modal } from "@/components/ui/modal";

type AnalysisResult = {
  novelName: string;
  fullAnalysis: string;
};

type ReferenceModalProps = {
  open: boolean;
  onClose: () => void;
};

type Screen = "input" | "loading" | "result" | "error";

export function ReferenceModal({ open, onClose }: ReferenceModalProps) {
  const [screen, setScreen] = useState<Screen>("input");
  const [novelName, setNovelName] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAnalyze() {
    if (!novelName.trim()) return;
    setScreen("loading");
    setError("");
    setSaveMessage("");

    startTransition(async () => {
      try {
        // First ensure a placeholder document exists for the analysis
        const createRes = await fetch("/api/projects/current/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "setting",
            title: `参考分析-${novelName.trim()}`,
          }),
        });
        const createPayload = await createRes.json();
        if (!createRes.ok || !createPayload.ok) {
          throw new Error(createPayload.error || "创建分析文档失败");
        }

        const fileName = createPayload.data.document.fileName;

        // Run the reference analysis AI action
        const actionRes = await fetch("/api/projects/current/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "setting",
            fileName,
            mode: "reference_analysis",
            userRequest: novelName.trim(),
            applyMode: "replace",
          }),
        });
        const actionPayload = await actionRes.json();
        if (!actionRes.ok || !actionPayload.ok) {
          throw new Error(actionPayload.error || "AI 分析失败");
        }

        setResult({
          novelName: novelName.trim(),
          fullAnalysis: actionPayload.data.document?.content || actionPayload.data.generatedText || "",
        });
        setScreen("result");
        setSaveMessage(`已保存为设定文档：${fileName}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "分析失败");
        setScreen("error");
      }
    });
  }

  function handleReset() {
    setNovelName("");
    setResult(null);
    setError("");
    setSaveMessage("");
    setScreen("input");
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  // Parse sections from the full analysis markdown
  function parseSections(text: string) {
    const sections: Array<{ title: string; content: string }> = [];
    const lines = text.split("\n");
    let currentTitle = "";
    let currentContent: string[] = [];

    for (const line of lines) {
      const h2Match = line.match(/^##\s+\d+\.\s*(.+)/);
      if (h2Match) {
        if (currentTitle) {
          sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
        }
        currentTitle = h2Match[1];
        currentContent = [];
      } else if (currentTitle) {
        currentContent.push(line);
      }
    }
    if (currentTitle) {
      sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
    }

    return sections.length > 0 ? sections : [{ title: "分析结果", content: text }];
  }

  const DIMENSION_ICONS: Record<string, string> = {
    "节奏": "\u{1F3B5}",
    "升级": "\u{1F4C8}",
    "力量": "\u{1F4C8}",
    "反转": "\u{1F504}",
    "钩子": "\u{1F3A3}",
    "角色": "\u{1F464}",
    "弧光": "\u{1F464}",
    "爽点": "\u{26A1}",
    "应用": "\u{1F4A1}",
  };

  function getIcon(title: string) {
    for (const [key, icon] of Object.entries(DIMENSION_ICONS)) {
      if (title.includes(key)) return icon;
    }
    return "\u{1F4D6}";
  }

  return (
    <Modal open={open} onClose={handleClose} title="参考作品分析" eyebrow="机制提炼 · 原创护栏" variant="wide">
      {/* Input Screen */}
      {screen === "input" && (
        <div className="form-card">
          <p className="muted">
            输入热门小说名称，AI 将提炼其结构机制（节奏、升级体系、反转手法、钩子模式、角色弧光、爽点设计）。
            只提取抽象机制，不复用任何具体内容，确保原创性。
          </p>
          <label>
            <span>参考作品名称</span>
            <input
              value={novelName}
              onChange={(e) => setNovelName(e.target.value)}
              placeholder="例如：斗破苍穹、诡秘之主、凡人修仙传"
              onKeyDown={(e) => { if (e.key === "Enter") handleAnalyze(); }}
            />
          </label>
          <div className="ref-suggestions">
            {["斗破苍穹", "诡秘之主", "全职高手", "庆余年", "凡人修仙传"].map((name) => (
              <button
                key={name}
                type="button"
                className="ref-suggestion-chip"
                onClick={() => setNovelName(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="gen-controls">
            <button
              type="button"
              className="action-button"
              onClick={handleAnalyze}
              disabled={!novelName.trim() || isPending}
            >
              开始分析
            </button>
          </div>
        </div>
      )}

      {/* Loading Screen */}
      {screen === "loading" && (
        <div className="form-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <span className="ai-spinner" style={{ width: 24, height: 24 }} />
          <p style={{ marginTop: 16, color: "var(--muted)" }}>
            正在分析《{novelName}》的结构机制...
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            提炼节奏模板、升级体系、反转手法、钩子模式、角色弧光、爽点设计
          </p>
        </div>
      )}

      {/* Error Screen */}
      {screen === "error" && (
        <div className="form-card" style={{ textAlign: "center", padding: "32px 24px" }}>
          <p className="modal-error">{error}</p>
          <div className="gen-controls" style={{ justifyContent: "center" }}>
            <button type="button" className="action-button" onClick={handleAnalyze}>
              重试
            </button>
            <button type="button" className="action-button secondary" onClick={handleReset}>
              返回
            </button>
          </div>
        </div>
      )}

      {/* Result Screen */}
      {screen === "result" && result && (
        <div className="form-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p className="eyebrow">结构机制分析</p>
              <strong style={{ fontSize: 18 }}>《{result.novelName}》</strong>
            </div>
          </div>

          {saveMessage && (
            <p className="creation-editor-message success">{saveMessage}</p>
          )}

          <div className="ref-analysis-grid">
            {parseSections(result.fullAnalysis).map((section, i) => (
              <div key={i} className="ref-analysis-card">
                <div className="ref-analysis-card-header">
                  <span className="ref-analysis-icon">{getIcon(section.title)}</span>
                  <strong>{section.title}</strong>
                </div>
                <div className="ref-analysis-card-body">
                  <pre className="context-pre">{section.content}</pre>
                </div>
              </div>
            ))}
          </div>

          <div className="gen-controls">
            <button type="button" className="action-button secondary" onClick={handleReset}>
              再分析一部
            </button>
            <button type="button" className="action-button" onClick={handleClose}>
              完成
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
