// Whether this server's page measures visits with Vercel Web Analytics (spec 012).
// WEB_ANALYTICS is set explicitly in Vercel's Production and Preview environments: Vercel's docs
// don't say its VERCEL system variable reaches a Container deployment, so VERCEL=1 is only a
// fallback for an unset WEB_ANALYTICS. Local servers, tests and e2e checks have neither, so they
// stay off. notice-only shows the privacy notice without loading the script (browser checks).

export type AnalyticsMode = 'measure' | 'notice-only' | 'off';

export interface AnalyticsSetting {
  mode: AnalyticsMode;
  /** The raw WEB_ANALYTICS value when it was not on, off or notice-only. */
  invalid?: string;
}

export function resolveAnalyticsMode(
  env: Record<string, string | undefined> = process.env,
): AnalyticsSetting {
  const raw = env.WEB_ANALYTICS?.trim() ?? '';
  switch (raw.toLowerCase()) {
    case 'on':
      return { mode: 'measure' };
    case 'off':
      return { mode: 'off' };
    case 'notice-only':
      return { mode: 'notice-only' };
    case '':
      return { mode: env.VERCEL === '1' ? 'measure' : 'off' };
    default:
      return { mode: 'off', invalid: raw };
  }
}
