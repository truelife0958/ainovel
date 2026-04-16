import { asArray } from "../utils.js";

/**
 * @param {{ missingFields?: string[]; warnings?: Array<{ severity?: string }> } | null | undefined} validation
 */
export function evaluateChapterWriteGuard(validation) {
  const missingFields = asArray(validation?.missingFields);
  const warnings = asArray(validation?.warnings);
  const highWarnings = warnings.filter((warning) => warning && warning.severity === "high");

  const requiresConfirmation = missingFields.length >= 3 || highWarnings.length > 0;

  if (!requiresConfirmation) {
    return {
      requiresConfirmation: false,
      summary: "",
      buttonLabel: "AI 生成正文",
    };
  }

  const parts = [];
  if (missingFields.length >= 3) {
    parts.push(`任务书仍缺 ${missingFields.length} 项`);
  }
  if (highWarnings.length > 0) {
    parts.push(`存在 ${highWarnings.length} 条高风险提醒`);
  }

  return {
    requiresConfirmation: true,
    summary: `${parts.join("，")}。再次点击后仍可继续生成正文。`,
    buttonLabel: "再次点击确认生成",
  };
}
