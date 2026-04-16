"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalVariant = "standard" | "wide" | "compact";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  variant?: ModalVariant;
  children: ReactNode;
};

export function Modal({ open, onClose, title, eyebrow, variant = "standard", children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const count = parseInt(document.body.dataset.overlayCount || "0", 10);
    document.body.dataset.overlayCount = String(count + 1);
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleEscape);

    dialogRef.current?.focus();

    return () => {
      const next = parseInt(document.body.dataset.overlayCount || "1", 10) - 1;
      document.body.dataset.overlayCount = String(next);
      if (next <= 0) {
        document.body.style.overflow = "";
        delete document.body.dataset.overlayCount;
      }
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
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
            onClick={onClose}
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
