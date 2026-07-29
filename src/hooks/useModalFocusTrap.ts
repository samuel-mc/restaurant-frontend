"use client";

/**
 * Focus trap + Escape + restore focus for modal overlays
 * (admin dialogs and customer cart sheet).
 */

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseModalFocusTrapOptions {
  open: boolean;
  /** Called on Escape when escapeEnabled. */
  onEscape: () => void;
  /** When false, Escape is ignored (e.g. while busy). Default true. */
  escapeEnabled?: boolean;
  /** Optional element to focus first (falls back to first focusable). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Lock document scroll while open. Default true (modals). */
  lockScroll?: boolean;
}

export function useModalFocusTrap({
  open,
  onEscape,
  escapeEnabled = true,
  initialFocusRef,
  lockScroll = true,
}: UseModalFocusTrapOptions): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  const escapeEnabledRef = useRef(escapeEnabled);
  onEscapeRef.current = onEscape;
  escapeEnabledRef.current = escapeEnabled;

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

    const initial = initialFocusRef?.current ?? focusables()[0];
    window.requestAnimationFrame(() => {
      initial?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    if (lockScroll) {
      document.body.style.overflow = "hidden";
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!escapeEnabledRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!container.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey, true);

    return () => {
      if (lockScroll) {
        document.body.style.overflow = previousOverflow;
      }
      window.removeEventListener("keydown", onKey, true);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open, initialFocusRef, lockScroll]);

  return containerRef;
}
