"use client";

import { FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { SummaryCard } from "@/components/summary-card";
import type { ProjectIdeation } from "@/types/ideation";

type IdeationFormProps = {
  initialIdeation: ProjectIdeation;
};

export function IdeationForm({ initialIdeation }: IdeationFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialIdeation);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const completionItems = [
    form.title,
    form.genre,
    form.targetReader,
    form.platform,
    form.protagonistName,
    form.goldenFingerName,
    form.coreSellingPoints,
  ];
  const completionCount = completionItems.filter((item) => String(item || "").trim()).length;
  const completionTotal = completionItems.length;

  function updateField<Key extends keyof ProjectIdeation>(field: Key, value: ProjectIdeation[Key]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/projects/current/ideation", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          setMessage(payload.error || "保存立项失败");
          return;
        }

        setForm(payload.data);
        setMessage("立项信息已保存");
        router.refresh();
      } catch {
        setMessage("网络错误，保存立项失败，请重试。");
      }
    });
  }

  return (
    <form className="settings-stack" onSubmit={handleSubmit}>
      <section className="summary-strip">
        <SummaryCard eyebrow="立项完成度">
          <strong>{completionCount} / {completionTotal}</strong>
          <p className="muted">先补标题、题材、读者、主角和卖点。</p>
        </SummaryCard>
        <SummaryCard eyebrow="当前定位">
          <strong>{form.genre || "待定题材"}</strong>
          <p className="muted">{form.targetReader || "目标读者未填写"} · {form.platform || "发布平台未填写"}</p>
        </SummaryCard>
        <SummaryCard eyebrow="核心卖点">
          <strong>{form.goldenFingerName || "待定金手指"}</strong>
          <p className="muted">{form.goldenFingerType || "类型未填"} · {form.goldenFingerStyle || "风格未填"}</p>
        </SummaryCard>
      </section>

      <div className="list-card form-card">
        <p className="eyebrow">基础定位</p>
        <div className="form-grid">
          <label>
            <span>作品标题</span>
            <input value={form.title} onChange={(event) => updateField("title", event.target.value)} />
          </label>
          <label>
            <span>题材方向</span>
            <input value={form.genre} onChange={(event) => updateField("genre", event.target.value)} />
          </label>
          <label>
            <span>目标读者</span>
            <input
              value={form.targetReader}
              onChange={(event) => updateField("targetReader", event.target.value)}
            />
          </label>
          <label>
            <span>发布平台</span>
            <input
              value={form.platform}
              onChange={(event) => updateField("platform", event.target.value)}
            />
          </label>
          <label>
            <span>目标字数</span>
            <input
              type="number"
              min="0"
              value={form.targetWords}
              onChange={(event) => updateField("targetWords", Number(event.target.value))}
            />
          </label>
          <label>
            <span>目标章节</span>
            <input
              type="number"
              min="0"
              value={form.targetChapters}
              onChange={(event) => updateField("targetChapters", Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="list-card form-card">
        <p className="eyebrow">主角与卖点</p>
        <div className="form-grid">
          <label>
            <span>主角名</span>
            <input
              value={form.protagonistName}
              onChange={(event) => updateField("protagonistName", event.target.value)}
            />
          </label>
          <label>
            <span>主角结构</span>
            <input
              value={form.protagonistStructure}
              onChange={(event) => updateField("protagonistStructure", event.target.value)}
            />
          </label>
          <label>
            <span>金手指名称</span>
            <input
              value={form.goldenFingerName}
              onChange={(event) => updateField("goldenFingerName", event.target.value)}
            />
          </label>
          <label>
            <span>金手指类型</span>
            <input
              value={form.goldenFingerType}
              onChange={(event) => updateField("goldenFingerType", event.target.value)}
            />
          </label>
          <label>
            <span>金手指风格</span>
            <input
              value={form.goldenFingerStyle}
              onChange={(event) => updateField("goldenFingerStyle", event.target.value)}
            />
          </label>
          <label className="span-two">
            <span>核心卖点</span>
            <textarea
              rows={6}
              value={form.coreSellingPoints}
              onChange={(event) => updateField("coreSellingPoints", event.target.value)}
            />
          </label>
        </div>
        <div className="list-card inner-card">
          <p className="eyebrow">一句话立项摘要</p>
          <p className="muted context-pre">
            {[
              form.title || "未命名作品",
              form.genre || "待定题材",
              form.protagonistName ? `主角 ${form.protagonistName}` : "主角待定",
              form.goldenFingerName ? `金手指 ${form.goldenFingerName}` : "金手指待定",
            ].join("｜")}
          </p>
          <p className="muted">
            {form.coreSellingPoints.trim() || "核心卖点还没写。"}
          </p>
        </div>
        <div className="form-actions">
          <button type="submit" className="action-button secondary" disabled={isPending}>
            {isPending ? "保存中..." : "保存立项信息"}
          </button>
          <Link href="/workspace" className="action-button">
            进入创作
          </Link>
          <p className="muted">
            {message || "填写核心定位后，点击进入创作开始工作。"}
          </p>
        </div>
      </div>
    </form>
  );
}
