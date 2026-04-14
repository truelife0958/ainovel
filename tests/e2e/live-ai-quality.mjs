import { expect } from "@playwright/test";
import { parseChapterBriefContent, validateChapterBrief } from "../../lib/projects/brief-format.js";

export function assertChapterBriefQuality(briefContent) {
  const parsedBrief = parseChapterBriefContent(briefContent);
  const validation = validateChapterBrief(parsedBrief);

  expect(validation.missingFields).toEqual([]);
  expect(validation.warnings.filter((warning) => warning.severity === "high")).toEqual([]);
  expect(parsedBrief.goal.length).toBeGreaterThan(0);
  expect(parsedBrief.obstacle.length).toBeGreaterThan(0);
  expect(parsedBrief.cost.length).toBeGreaterThan(0);
  expect(parsedBrief.endQuestion.length).toBeGreaterThan(0);
  expect((parsedBrief.hook || parsedBrief.rawHook).length).toBeGreaterThan(0);

  return { parsedBrief, validation };
}

export function assertChapterDraftQuality(chapterContent, options = {}) {
  const minimumChars = Number(options.minimumChars || 400);
  const titlePattern = options.titlePattern || /第0002章|第 2 章|雾站|账本/;

  expect(chapterContent.length).toBeGreaterThanOrEqual(minimumChars);
  expect(chapterContent.split(/\n{2,}/).length).toBeGreaterThanOrEqual(3);
  expect(chapterContent).toMatch(titlePattern);
}

export function assertOutlineQuality(outlineContent, options = {}) {
  const minimumChars = Number(options.minimumChars || 300);
  const requiredPatterns = options.requiredPatterns || [
    /冲突/,
    /节拍|推进|节点/,
    /钩子|兑现/,
  ];

  expect(outlineContent.length).toBeGreaterThanOrEqual(minimumChars);
  expect(outlineContent).toMatch(/^#/m);
  expect(outlineContent.split(/\n#{1,3}\s+/).length).toBeGreaterThanOrEqual(3);

  for (const pattern of requiredPatterns) {
    expect(outlineContent).toMatch(pattern);
  }
}
