"use client";

import { useEffect, useRef, type ReactNode } from "react";

type DropdownProps = {
  trigger: ReactNode;
  open: boolean;
  onClose: () => void;
  align?: "left" | "right";
  direction?: "down" | "up";
  children: ReactNode;
};

export function Dropdown({ trigger, open, onClose, align = "left", direction = "down", children }: DropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  return (
    <div ref={containerRef} className="dropdown-container" aria-haspopup="listbox" aria-expanded={open}>
      {trigger}
      {open && (
        <div className={`dropdown-panel ${align}${direction === "up" ? " up" : ""}`} role="listbox">
          {children}
        </div>
      )}
    </div>
  );
}
