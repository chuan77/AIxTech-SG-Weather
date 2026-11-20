// Cold or warm label for each page load measured by Vercel Speed Insights (spec 016).
// A page request served within 10 seconds of the process starting is "cold": it woke the
// instance, which takes about 5 s after the 5-minute idle stop (docs/deployment.md). Requests the
// instance served first (the health check, platform probes, API calls) don't change this, so a
// visitor who shared the wake-up wait is still counted cold (spec clarification Q4).

export type VisitLabel = 'cold' | 'warm';

export const COLD_WINDOW_SECONDS = 10;

export function visitLabel(uptimeSeconds: number): VisitLabel {
  return uptimeSeconds < COLD_WINDOW_SECONDS ? 'cold' : 'warm';
}

/** Picks the pre-rendered page for this request: one comparison, no I/O. */
export function pageFor(pages: Record<VisitLabel, string>, uptimeSeconds: number): string {
  return pages[visitLabel(uptimeSeconds)];
}
