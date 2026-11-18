import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HINT_DISMISSED_KEY,
  HINT_SEEN_KEY,
  isStandalone,
  readFlag,
  shouldShowInstallHint,
  writeFlag,
  type FlagStorage,
} from '../install/installHint';
import { ShareIcon } from './icons';

const TIP_ID = 'install-hint-tip';
const TITLE_ID = 'install-hint-title';

function browserStorage(): FlagStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * iPhone/iPad Safari only (spec 014, contracts/install-hint.md): a button in the Add row that opens
 * a tip on adding Lepak to the Home Screen, and says the home-screen app keeps its own list.
 * Renders nothing for everyone else. Got it hides it for good; the flags never leave the device.
 */
export function InstallHint({ savedCount }: { savedCount: number }) {
  const storage = useMemo(() => browserStorage(), []);
  // The device and browser don't change while the page is open.
  const device = useMemo(
    () => ({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      standalone: isStandalone(navigator as { standalone?: boolean }, (query) =>
        window.matchMedia(query),
      ),
    }),
    [],
  );
  const [dismissed, setDismissed] = useState(() => readFlag(storage, HINT_DISMISSED_KEY));
  const [seen, setSeen] = useState(() => readFlag(storage, HINT_SEEN_KEY));
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLElement>(null);

  const show = shouldShowInstallHint({ ...device, dismissed, savedCount });

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (tipRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  if (!show) return null;

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!seen) {
      writeFlag(storage, HINT_SEEN_KEY);
      setSeen(true);
    }
  };

  const gotIt = () => {
    writeFlag(storage, HINT_DISMISSED_KEY);
    // The button is about to go: hand focus to the row's first control (Use my location).
    buttonRef.current?.parentElement?.querySelector<HTMLButtonElement>('button')?.focus();
    setOpen(false);
    setDismissed(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? TIP_ID : undefined}
        data-install-hint=""
        // The row's two buttons already fill it on phones and in the sidebar, so this takes its
        // own full-width line directly under them (owner's choice, 2026-11-18).
        className={`relative flex min-h-11 basis-full items-center justify-center gap-2 rounded-card border px-3 py-2.5 text-sm font-medium backdrop-blur-xl ${
          open
            ? 'border-white/30 bg-white/20 text-white'
            : 'border-white/15 bg-white/[0.07] text-white/85 hover:bg-white/[0.12]'
        }`}
      >
        <ShareIcon className="h-4 w-4 shrink-0" />
        <span>Add Lepak to Home Screen</span>
        {!seen && (
          <span
            aria-hidden="true"
            data-install-hint-dot=""
            className="dock-badge absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full"
          />
        )}
      </button>
      {open && (
        <section
          ref={tipRef}
          id={TIP_ID}
          aria-labelledby={TITLE_ID}
          // Its own full-width line under the button row, beside any "Use my location" message.
          className="app-popover order-1 grid basis-full gap-2 rounded-card border border-white/15 p-3 text-sm text-white shadow-lg shadow-black/30"
        >
          <h2 id={TITLE_ID} className="font-semibold">
            Add Lepak to your Home Screen
          </h2>
          <p>
            Tap <strong>Share</strong> <ShareIcon className="inline h-4 w-4 align-text-bottom" />,
            then <strong>Add to Home Screen</strong>.
          </p>
          <p className="text-ink-muted">
            The Home Screen app keeps its own list. Places saved here in Safari won’t appear there,
            so you’ll add them again.
          </p>
          <button
            type="button"
            onClick={gotIt}
            className="min-h-11 justify-self-end rounded-full border border-white/20 px-4 font-medium text-white hover:bg-white/10 md:pointer-fine:min-h-9"
          >
            Got it
          </button>
        </section>
      )}
    </>
  );
}
