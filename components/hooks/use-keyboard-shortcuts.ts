"use client";

import { useEffect, useRef } from "react";

export type KeyboardShortcutsOptions = {
  onSave: () => void;
  onToggleBrief: () => void;
  onCloseBrief: () => void;
  canSave: boolean;
  briefPanelOpen: boolean;
  chapterContext: boolean;
};

/**
 * Single document-level keydown listener handling:
 *   - Ctrl/Cmd+S → save (if canSave)
 *   - Ctrl/Cmd+B → toggle brief panel (only when chapterContext)
 *   - Escape    → close brief panel (when open)
 *
 * Callbacks are captured in a ref so the listener registers once per
 * mount; re-renders don't reattach it.
 */
export function useKeyboardShortcuts(opts: KeyboardShortcutsOptions) {
  const ref = useRef(opts);
  useEffect(() => { ref.current = opts; }, [opts]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const s = ref.current;
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        if (s.canSave) s.onSave();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "b" && s.chapterContext) {
        event.preventDefault();
        s.onToggleBrief();
        return;
      }
      if (event.key === "Escape" && s.briefPanelOpen) {
        s.onCloseBrief();
        return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
