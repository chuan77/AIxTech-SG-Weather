# Contract: Speed Insights metas in `index.html` and the `SPEED_INSIGHTS` setting

This extends [spec 012's contract](../../012-vercel-web-analytics/contracts/index-html-meta.md). The `web-analytics` meta is unchanged.

## Server setting

- **Name**: `SPEED_INSIGHTS`, read once at server start.
- **Values**: `on`, `off` or `notice-only` (case-insensitive, trimmed). Empty means unset.
- **Default when unset**: `measure` if `VERCEL === '1'`, otherwise `off`.
- **Invalid value**: `off`, plus one startup `warn`: `SPEED_INSIGHTS=<value> is not on, off or notice-only; measurement is off`.
- **Startup log**: one `info` line, `speed insights mode`, with `{ speedInsights: <mode>, vercel: <bool> }`. No other settings are logged.
- **Where it is set**:
  - Vercel: `on` for Production and Preview.
  - Never in the Dockerfile, `.env.example` or CI.
  - Blanked by `vitest.config.ts` and `scripts/e2e/lib.sh`. The latter passes `E2E_SPEED_INSIGHTS` through.

## Page contract

Only the production server path writes these metas, immediately before `</head>`:

```html
<!-- SPEED_INSIGHTS=on -->
<meta name="speed-insights" content="measure" />
<meta name="speed-insights-visit" content="cold" />   <!-- or "warm", per request -->

<!-- SPEED_INSIGHTS=notice-only (e2e) -->
<meta name="speed-insights" content="notice-only" />  <!-- no visit meta -->

<!-- SPEED_INSIGHTS=off: no speed-insights metas -->
```

- At most one of each tag. Values are only the fixed literals shown. The server never writes text from the environment into them.
- `speed-insights-visit` is present only in `measure`. It is `cold` when `process.uptime() < 10` at the moment the request is served, and `warm` otherwise.
- **Cost**: two complete page strings are rendered at startup. Per request, the server makes one number comparison and sends one string, with no I/O and no extra request.
- **Client parsing**:
  - The mode: missing, empty or unknown means `off`.
  - The label: anything other than `cold` or `warm` means no route.

## Network contract in `measure` mode

- Exactly one `GET /_vercel/speed-insights/script.js` (same origin, deferred, injected after first render), with `data-route="/cold"` or `"/warm"` on the script tag. Vercel serves it, never Express. FR-001 / research R1 checks this on a preview.
- Vitals are sent by that script to Vercel's same-origin intake. The reported `url` has no query string or fragment (`beforeSend` = `stripUrl`).
- In `off` and `notice-only`: zero requests to `/_vercel/speed-insights/*` or `va.vercel-scripts.com`.
- A failed script load produces at most the package's `console.log` line, never a page error or `console.error`.

## Tests that guard it

- `backend/src/analyticsMode.test.ts`: the full `SPEED_INSIGHTS` value table, including that it is independent of `WEB_ANALYTICS`.
- `backend/src/speedInsights.test.ts`: `visitLabel` at 0, 9.999, 10 and 3600 s.
- `backend/src/indexHtml.test.ts`:
  - the metas for each mode and label;
  - no visit meta in `notice-only` or `off`;
  - coexistence with the CARTO and `web-analytics` metas.
- `frontend/src/analytics/speedInsightsMode.test.ts`: parsing the mode and the label into a route.
- `frontend/src/analytics/stripUrl.test.ts`: a Speed Insights-shaped event keeps `type` and `route`.
- `scripts/e2e/privacy-notice.sh`: no Speed Insights requests in `notice-only` or `off`.
