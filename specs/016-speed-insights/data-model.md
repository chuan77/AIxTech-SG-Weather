# Data Model: spec 016

The app stores nothing new: no table, column, migration or log field. Every value below lives only in memory, in the served page, or with Vercel.

## Measurement mode (per server process)

- **Name**: `SpeedInsightsMode`, with the values `measure`, `notice-only` and `off`.
- **Source**: the `SPEED_INSIGHTS` setting, resolved once at startup. The rules match `WEB_ANALYTICS` (see [research.md](research.md) R5).
- **Lifecycle**: fixed for the process lifetime. A change needs a restart or redeploy.
- **Independence**: separate from the visit-counting `AnalyticsMode`. Each can be `off` alone.

## Visit label (per page request)

- **Name**: `VisitLabel`, with the values `cold` and `warm`.
- **Rule**: `cold` when `process.uptime() < 10` at the moment the page request is served, otherwise `warm`. The boundary at exactly 10 s is `warm`.
- **Where**: decided by the server only for page responses (`GET /index.html` and the SPA fallback), and only when the mode is `measure`. It is written as `<meta name="speed-insights-visit">`.
- **On the client**: mapped to the Speed Insights route `/cold` or `/warm`. A missing or unknown value means no route is passed, so the platform reports `/`.
- **Transitions**: none. Each page load gets one label, and it never changes during the page's life.

## Performance reading (held by Vercel)

Produced by Vercel's script. The app never stores it. Vercel stores, per data point, the route (`/cold` or `/warm`), the URL without query or fragment, network speed, browser, device type, OS, country, the web vital and its attribution, SDK information and the time received. There are up to 5 data points per visit.

## Privacy copy (per page)

- **Input**: `{ visits: boolean, speed: boolean }`, where `visits` = analytics mode ≠ `off` and `speed` = Speed Insights mode ≠ `off`.
- **Output**:
  - `null` when both are false, so no notice is shown;
  - otherwise `{ label: string, paragraphs: string[] }` as in [contracts/privacy-notice-ui.md](contracts/privacy-notice-ui.md).

## Lab baseline (documentation only)

A dated row in `docs/deployment.md` for each profile (Mobile, Desktop), with the medians of 3 PageSpeed Insights runs: performance score, FCP, LCP, TBT, CLS, Speed Index and TTFB.
