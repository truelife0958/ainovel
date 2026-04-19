export function formatSummary(project) {
  return [
    `Title: ${project.title}`,
    `Genre: ${project.genre}`,
    `Current Chapter: ${project.currentChapter || 0}`,
    `Current Volume: ${project.currentVolume || 0}`,
    `Total Words: ${project.totalWords || 0}`,
    `Target Words: ${project.targetWords || 0}`,
    `Target Chapters: ${project.targetChapters || 0}`,
    `Setting Files: ${project.settingFilesCount || 0}`,
    `Outline Files: ${project.outlineFilesCount || 0}`,
    `Chapter Files: ${project.chaptersCount || 0}`,
  ].join("\n");
}

export function formatIdeation(ideation) {
  return [
    `Project Title: ${ideation.title || "Not provided"}`,
    `Genre Focus: ${ideation.genre || "Not provided"}`,
    `Target Reader: ${ideation.targetReader || "Not provided"}`,
    `Platform: ${ideation.platform || "Not provided"}`,
    `Core Selling Points: ${ideation.coreSellingPoints || "Not provided"}`,
    `Protagonist Name: ${ideation.protagonistName || "Not provided"}`,
    `Protagonist Structure: ${ideation.protagonistStructure || "Not provided"}`,
    `Golden Finger Name: ${ideation.goldenFingerName || "Not provided"}`,
    `Golden Finger Type: ${ideation.goldenFingerType || "Not provided"}`,
    `Golden Finger Style: ${ideation.goldenFingerStyle || "Not provided"}`,
  ].join("\n");
}

export function formatDocument(document) {
  return [`Title: ${document.title}`, `File: ${document.fileName}`, "", document.content].join("\n");
}

export function formatContext(chapterContext) {
  return [
    `Chapter Number: ${chapterContext.chapterNumber || 0}`,
    `Outline Excerpt: ${chapterContext.outline || "None"}`,
    chapterContext.previousSummaries.length > 0
      ? ["Previous Summaries:", ...chapterContext.previousSummaries].join("\n\n")
      : "Previous Summaries: None",
    `State Summary: ${chapterContext.stateSummary || "None"}`,
    chapterContext.guidanceItems.length > 0
      ? `Guidance Items: ${chapterContext.guidanceItems.join(" | ")}`
      : "Guidance Items: None",
    chapterContext.error ? `Context Notes: ${chapterContext.error}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
