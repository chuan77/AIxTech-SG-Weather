import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronUpIcon } from './icons';

/**
 * One quiet line saying visits are counted anonymously, which opens a short explanation in place
 * (spec 012, PDPA disclosure). Hero shows it only where measurement is active (or notice-only in
 * browser checks), so it never claims counting that isn't happening.
 */
export function PrivacyNotice() {
  const [expanded, setExpanded] = useState(false);
  const explanationId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const explanationRef = useRef<HTMLParagraphElement>(null);

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
        Anonymous visit counts · no cookies
        <ChevronUpIcon
          className={`h-3.5 w-3.5 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? '' : 'rotate-180'}`}
        />
      </button>
      <p
        ref={explanationRef}
        id={explanationId}
        hidden={!expanded}
        className="mb-2 max-w-sm scroll-mb-[calc(var(--dock-height,0px)+0.75rem)] px-4 text-left text-xs leading-relaxed text-ink-muted"
      >
        We count visits to see whether this app is useful. Vercel Web Analytics, our host&rsquo;s
        built-in tool, records the page, the site that linked here, your country, region and city,
        and your device type, operating system and browser. It uses no cookies, no account and no
        precise location, and never sees your saved places. Visitors are told apart by an anonymous
        value that resets every day. Places you save are kept on our server under a random code
        stored only in this browser, so no one else can see them. Clearing this browser&rsquo;s data
        loses them, and they&rsquo;re deleted after 90 days without use.
      </p>
    </div>
  );
}
