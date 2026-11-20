// Whether this server's page measures visitors with Vercel's built-in tools. Two independent
// settings use the same rules: WEB_ANALYTICS for visit counts (spec 012) and SPEED_INSIGHTS for
// page speed (spec 016). Each is set explicitly in Vercel's Production and Preview environments:
// Vercel's docs don't say its VERCEL system variable reaches a Container deployment, so VERCEL=1
// is only a fallback for an unset value. Local servers, tests and e2e checks have neither, so they
// stay off. notice-only shows the privacy notice without loading the script (browser checks).

export type AnalyticsMode = 'measure' | 'notice-only' | 'off';
export type SpeedInsightsMode = AnalyticsMode;

export interface AnalyticsSetting {
  mode: AnalyticsMode;
  /** The raw setting value when it was not on, off or notice-only. */
  invalid?: string;
}

export function resolveMeasurementMode(
  raw: string | undefined,
  env: Record<string, string | undefined>,
): AnalyticsSetting {
  const value = raw?.trim() ?? '';
  switch (value.toLowerCase()) {
    case 'on':
      return { mode: 'measure' };
    case 'off':
      return { mode: 'off' };
    case 'notice-only':
      return { mode: 'notice-only' };
    case '':
      return { mode: env.VERCEL === '1' ? 'measure' : 'off' };
    default:
      return { mode: 'off', invalid: value };
  }
}

export function resolveAnalyticsMode(
  env: Record<string, string | undefined> = process.env,
): AnalyticsSetting {
  return resolveMeasurementMode(env.WEB_ANALYTICS, env);
}

export function resolveSpeedInsightsMode(
  env: Record<string, string | undefined> = process.env,
): AnalyticsSetting {
  return resolveMeasurementMode(env.SPEED_INSIGHTS, env);
}
