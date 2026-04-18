"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { queryFocusableElements } from "@/lib/ui/focus-trap.js";

type ModalVariant = "standard" | "wide" | "compact";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  variant?: ModalVariant;
  /**
   * Return true when the modal has unsaved changes; the Modal will ask the
   * user to confirm before invoking `onClose` (overlay click, ESC, close X).
   */
  confirmCloseIfDirty?: () => boolean;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  variant = "standard",
  confirmCloseIfDirty,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  function requestClose() {
    if (confirmCloseIfDirty?.()) {
      const ok = typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm("有未保存的更改，确定放弃吗？")
        : true;
      if (!ok) return;
    }
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const count = parseInt(document.body.dataset.overlayCount || "0", 10);
    document.body.dataset.overlayCount = String(count + 1);
    document.body.style.overflow = "hidden";

    const previousFocus = document.activeElement as HTMLElement | null;

    // Move focus to the first interactive element (not the dialog itself)
    queueMicrotask(() => {
      const items = queryFocusableElements(dialogRef.current);
      if (items.length > 0) items[0].focus();
      else dialogRef.current?.focus();
    });

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { requestClose(); return; }
      if (event.key !== "Tab") return;
      const items = queryFocusableElements(dialogRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) { last.focus(); event.preventDefault(); }
      else if (!event.shiftKey && active === last) { first.focus(); event.preventDefault(); }
    }

    document.addEventListener("keydown", handleKey);

    return () => {
      const next = parseInt(document.body.dataset.overlayCount || "1", 10) - 1;
      document.body.dataset.overlayCount = String(next);
      if (next <= 0) {
        document.body.style.overflow = "";
        delete document.body.dataset.overlayCount;
      }
      document.removeEventListener("keydown", handleKey);
      // Return focus to the element that was focused before the modal opened.
      queueMicrotask(() => { previousFocus?.focus?.(); });
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={requestClose}>
      <div
        ref={dialogRef}
        className={`modal-dialog ${variant}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <strong className="modal-title">{title}</strong>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={requestClose}
            aria-label="关闭"
          >
            &times;
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
