# Contract: analytics mode in `index.html` and the `WEB_ANALYTICS` setting

## Server setting

- **Name**: `WEB_ANALYTICS`, read once at server start (`process.env`; `.env` via dotenv locally).
- **Values**: `on` | `off` | `notice-only` (case-insensitive, trimmed). Empty is the same as unset.
- **Default when unset**: `measure` if `VERCEL === '1'`, otherwise `off`.
- **Invalid value**: treated as `off`; logs one `warn` at startup: `WEB_ANALYTICS=<value> is not on, off or notice-only; measurement is off`.
- **Where it is set**:
  - Vercel → Project → Settings → Environment Variables: `on` for **Production** and **Preview**.
  - Not in the Dockerfile, `.env.example` or CI.
  - Blanked by `scripts/e2e/lib.sh` and `vitest.config.ts`.

## Page contract

Only the production-mode server path (`renderIndexHtml` in `backend/src/indexHtml.ts`) emits it, immediately before `</head>`, alongside the CARTO meta:

```html
<meta name="web-analytics" content="measure" />      <!-- script + notice -->
<meta name="web-analytics" content="notice-only" />  <!-- notice only (e2e) -->
<!-- no tag -->                                       <!-- off -->
```

- At most one tag. The value is one of the two literals above; the server never writes free text into it.
- The frontend treats a missing tag, empty content or any other value as `off`.

## Network contract in `measure` mode

- Exactly one `GET /_vercel/insights/script.js` (same origin, deferred, after first render). It is served by Vercel, never by Express. FR-001 verifies this on a preview.
- Page views are sent by that script to Vercel's same-origin endpoint. The reported URL has no query string or fragment (`beforeSend`).
- In `off` and `notice-only`: zero requests to `/_vercel/insights/*` or `va.vercel-scripts.com`.
- A failed script load produces at most a `console.log` line, never a page error or `console.error`.

## Tests that guard it

- `backend/src/analyticsMode.test.ts`: the full value table, including unknown values and blank strings.
- `backend/src/indexHtml.test.ts`: the tag for `measure` and `notice-only`, no tag for `off`, and coexistence with the CARTO meta.
- `frontend/src/analytics/analyticsMode.test.ts`: parsing of meta content (missing, empty, unknown → `off`).
- `frontend/src/analytics/stripUrl.test.ts`: query and fragment removed; origin and path kept.
- `scripts/e2e/privacy-notice.sh`: no measurement requests in `notice-only`.
