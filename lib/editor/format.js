/**
 * Apply a markdown-insert format to a textarea value + selection.
 * Returns the new value and the cursor position to place after.
 *
 * @typedef {{ type: "wrap", before: string, after: string }
 *          | { type: "prefix", prefix: string }
 *          | { type: "insert", text: string }} FormatAction
 *
 * @param {string} value
 * @param {number} selectionStart
 * @param {number} selectionEnd
 * @param {FormatAction} action
 * @returns {{ value: string, cursorPos: number }}
 */
export function applyFormatToText(value, selectionStart, selectionEnd, action) {
  const selected = value.slice(selectionStart, selectionEnd);

  if (action.type === "wrap") {
    const wrapped = `${action.before}${selected || "文本"}${action.after}`;
    return {
      value: value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd),
      cursorPos: selected
        ? selectionStart + wrapped.length
        : selectionStart + action.before.length,
    };
  }

  if (action.type === "prefix") {
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const lineContent = value.slice(lineStart, selectionEnd);
    if (lineContent.startsWith(action.prefix)) {
      return {
        value: value.slice(0, lineStart) + lineContent.slice(action.prefix.length) + value.slice(selectionEnd),
        cursorPos: selectionEnd - action.prefix.length,
      };
    }
    return {
      value: value.slice(0, lineStart) + action.prefix + value.slice(lineStart),
      cursorPos: selectionEnd + action.prefix.length,
    };
  }

  // insert
  return {
    value: value.slice(0, selectionStart) + action.text + value.slice(selectionEnd),
    cursorPos: selectionStart + action.text.length,
  };
}
