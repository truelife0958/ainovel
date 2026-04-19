export type FormatAction =
  | { type: "wrap"; before: string; after: string }
  | { type: "prefix"; prefix: string }
  | { type: "insert"; text: string };

export function applyFormatToText(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: FormatAction,
): { value: string; cursorPos: number };
