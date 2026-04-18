function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text) {
  // order matters: links first, then bold, then italic
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const safeUrl = /^(https?:\/\/|\/)/.test(url) ? url : "#";
    return `<a href="${safeUrl}" rel="noopener noreferrer">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

/**
 * Render a minimal Markdown subset to HTML. Supports:
 * #/##/### headings, **bold**, *italic*, - lists, 1. lists, > blockquote,
 * --- hr, paragraphs separated by blank lines, [text](url) links.
 * HTML inside content is always escaped (no raw HTML injection).
 *
 * @param {string} md
 * @returns {string}
 */
export function renderMarkdownToHtml(md) {
  const lines = String(md ?? "").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const stripped = line.trim();

    if (stripped === "") { i++; continue; }

    if (stripped === "---") { out.push("<hr>"); i++; continue; }

    if (/^### /.test(stripped)) { out.push(`<h3>${renderInline(stripped.slice(4))}</h3>`); i++; continue; }
    if (/^## /.test(stripped)) { out.push(`<h2>${renderInline(stripped.slice(3))}</h2>`); i++; continue; }
    if (/^# /.test(stripped)) { out.push(`<h1>${renderInline(stripped.slice(2))}</h1>`); i++; continue; }

    if (/^> /.test(stripped)) { out.push(`<blockquote>${renderInline(stripped.slice(2))}</blockquote>`); i++; continue; }

    if (/^- /.test(stripped)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().slice(2))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\. /.test(stripped)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().replace(/^\d+\. /, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // paragraph: accumulate until blank/structural line
    const para = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (l === "" || l === "---" || /^#{1,3} /.test(l) || /^> /.test(l) || /^- /.test(l) || /^\d+\. /.test(l)) break;
      para.push(l);
      i++;
    }
    if (para.length > 0) out.push(`<p>${renderInline(para.join(" "))}</p>`);
  }

  return out.join("");
}
