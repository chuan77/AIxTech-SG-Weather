import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

interface DockSheetProps {
  id: string;
  /** Accessible name, e.g. "Refresh options" or "Saved places". */
  label: string;
  open: boolean;
  onClose: () => void;
  /** The dock button that opened the sheet; focus returns to it on Escape. */
  triggerRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Phones only: a sheet that rises from the bottom dock for choices that don't fit in it (refresh
 * options, a long list of places). Non-modal: the page stays usable, and a tap outside, Escape or
 * a choice closes it. Opaque, because it floats over content (the Opaque Pop-up Rule).
 */
export function DockSheet({ id, label, open, onClose, triggerRef, children }: DockSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const first =
      sheet?.querySelector<HTMLElement>('[data-autofocus]') ??
      sheet?.querySelector<HTMLElement>('button:not(:disabled)');
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onClose();
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sheet?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={sheetRef}
      id={id}
      role="dialog"
      aria-label={label}
      className="dock-sheet app-popover fixed inset-x-0 bottom-[var(--dock-height,4.25rem)] z-40 max-h-[60dvh] overflow-y-auto rounded-t-card border-t border-white/10 px-3 pb-3 pt-3 md:hidden"
    >
      {children}
    </div>
  );
}
