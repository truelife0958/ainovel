function chapterFileName(chapterNumber) {
  return `第${String(chapterNumber).padStart(4, "0")}章.md`;
}

export function buildWritingRepairHref(chapterNumber, request) {
  if (!Number.isInteger(Number(chapterNumber)) || Number(chapterNumber) <= 0 || !String(request || "").trim()) {
    return "/workspace";
  }

  const params = new URLSearchParams({
    file: chapterFileName(Number(chapterNumber)),
    assistantRequest: String(request).trim(),
  });

  return `/workspace?${params.toString()}`;
}
