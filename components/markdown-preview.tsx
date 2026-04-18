"use client";

import { renderMarkdownToHtml } from "@/components/markdown-preview.render.js";

type MarkdownPreviewProps = {
  content: string;
  className?: string;
};

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const html = renderMarkdownToHtml(content);
  return (
    <div
      className={`markdown-preview ${className ?? ""}`}
      // Safe: renderMarkdownToHtml escapes all HTML inside content.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
