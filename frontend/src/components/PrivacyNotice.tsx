import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronUpIcon } from './icons';
import type { PrivacyCopy } from '../analytics/privacyCopy';

/**
 * One quiet line saying what is measured anonymously, which opens a short explanation in place
 * (specs 012 and 016, PDPA disclosure). The words come from privacyCopy, and Hero shows the notice
 * only where measurement is active (or notice-only in browser checks), so it never claims
 * measuring that isn't happening.
 */
export function PrivacyNotice({ copy }: { copy: PrivacyCopy }) {
  const [expanded, setExpanded] = useState(false);
  const explanationId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const explanationRef = useRef<HTMLDivElement>(null);

  // The notice sits at the very end of the page, so on phones the explanation opens below the
  // fold; bring it up, clear of the phone dock (scroll-margin uses --dock-height).
  useEffect(() => {
    if (!expanded) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    explanationRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [expanded]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && expanded) {
      event.stopPropagation();
      setExpanded(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col items-center" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={explanationId}
        className="inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-xs text-ink-muted hover:bg-white/10 hover:text-white"
      >
        {copy.label}
        <ChevronUpIcon
          className={`h-3.5 w-3.5 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? '' : 'rotate-180'}`}
        />
      </button>
      <div
        ref={explanationRef}
        id={explanationId}
        hidden={!expanded}
        className="mb-2 max-w-sm scroll-mb-[calc(var(--dock-height,0px)+0.75rem)] space-y-2 px-4 text-left text-xs leading-relaxed text-ink-muted"
      >
        {copy.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
