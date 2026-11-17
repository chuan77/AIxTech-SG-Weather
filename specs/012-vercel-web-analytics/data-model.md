# Data Model: Anonymous Visitor Measurement (spec 012)

No database, schema or migration change. The app stores nothing new. Visits live only in Vercel Web Analytics.

## AnalyticsMode (runtime setting, server → page)

| Value | Script loaded | Notice shown | Where it occurs |
|---|---|---|---|
| `measure` | yes | yes | hosted deployments (production, preview) |
| `notice-only` | **no** | yes | `scripts/e2e/privacy-notice.sh` only |
| `off` | no | no | local dev, local prod builds, tests, other e2e checks, owner switched off |

- **Server side**: `resolveAnalyticsMode(env)` maps `WEB_ANALYTICS` + `VERCEL` to a mode (table in [research.md](research.md) R3). It is pure and unit-tested. An unknown value gives `off` and one warning.
- **Transport**: `renderIndexHtml` adds `<meta name="web-analytics" content="measure|notice-only">` for those two modes; no tag for `off`. See [contracts/index-html-meta.md](contracts/index-html-meta.md).
- **Client side**: `readAnalyticsMode()` reads the meta once. A missing tag, empty value or unknown value gives `off`. It is pure (`parseAnalyticsMode(content)`) and unit-tested.
- **State transitions**: none at runtime. The mode is fixed per server start. Changing `WEB_ANALYTICS` takes a restart or redeploy (FR-004a).

## Visit (held by Vercel, not the app)

One page load in `measure` mode. Reported fields as Vercel stores them: timestamp, URL (origin + path; query and fragment removed by `beforeSend`, R5), referrer, country/region/city, device type, OS, browser, script version. The identifier is Vercel's daily-reset request hash; there are no cookies.

## PrivacyNotice (static UI content)

- **Collapsed label**: one line (FR-010).
- **Explanation**: fixed text covering what is counted, by whom, and what is not collected (FR-008).
- **State**: `expanded: boolean`, local to each instance, starting collapsed and not persisted.
- **Rendered when**: mode is `measure` or `notice-only` (FR-007).
