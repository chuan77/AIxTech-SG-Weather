# Quickstart: validating spec 012

Run from the repo root. The preview deploy and Vercel settings are outward actions: the owner runs or approves them.

## 0. Gate (FR-001), before writing code

```bash
git switch main && git pull
npx vercel@65.9.0 deploy                 # preview; check its Source tab has no .env or *.db
curl -s <preview-url>/_vercel/insights/script.js | head -c 200
```

If the preview is behind Vercel Authentication (curl gets a login page), use `npx vercel@65.9.0 curl` instead. The `vercel:access-protected-vercel-deployment` skill has the exact flags. Don't switch protection off.

- **Pass**: JavaScript (not starting with `<!DOCTYPE html>`). Continue.
- **Fail**: HTML from the app. Stop and return to `/speckit-assess-decide slug=vercel-web-analytics`.
- Also record whether `VERCEL=1` reaches the container. For example, read the runtime log line for the analytics mode once step 3 ships. That fact is informational: `WEB_ANALYTICS=on` is set explicitly either way.

## 1. Unit tests and full gate

```bash
npm run verify
```

Expect the new tests to pass: analytics mode (server + client), index meta, URL stripping. See [contracts/index-html-meta.md](contracts/index-html-meta.md).

## 2. Local runs are silent (FR-004, SC-003, SC-004)

```bash
for s in scripts/e2e/*.sh; do [ "$(basename "$s")" = lib.sh ] || "$s" || exit 1; done
```

Every existing check passes unchanged, with no new `E2E_ALLOW_ERRORS`. `npm run dev`: the page has no `web-analytics` meta, no request to `/_vercel/insights/` or `va.vercel-scripts.com`, and no notice.

## 3. Notice (FR-007–FR-010)

```bash
scripts/e2e/privacy-notice.sh            # starts its server with WEB_ANALYTICS=notice-only
```

It checks the [privacy-notice-ui.md](contracts/privacy-notice-ui.md) contract: both placements (with and without saved locations), keyboard and pointer toggle, `aria-expanded`, all six themes, 375 px and desktop, notice absent with `WEB_ANALYTICS=off`, and zero measurement requests. Then run the `impeccable` review of placement on phone and laptop, and the owner approves the copy.

## 4. Hosted check (US1)

1. Vercel → Settings → Environment Variables: `WEB_ANALYTICS=on` for Production and Preview.
2. Deploy the feature branch as a preview. Load it on a phone and a laptop: no console errors, notice present, and `/_vercel/insights/script.js` loaded.
3. Vercel → Analytics, environment filter **Preview**: the visits appear (SC-001).
4. Set `WEB_ANALYTICS=off` for Preview and redeploy: no script request and no notice (FR-004a). Restore `on`.
5. Merge to `main` (CI deploys). Within 24 h, production visits show under **Production**. After a later deploy or cold start, earlier days are still there (SC-002).

## 5. Docs (FR-012)

`docs/deployment.md` has the `WEB_ANALYTICS` row and the Web Analytics section. A reader can name the dashboard, the 50,000/month shared cap with pause-on-exhaustion, the 1-month window, and the off switch.
