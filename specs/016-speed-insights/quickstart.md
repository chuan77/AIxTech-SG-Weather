# Quickstart: validating spec 016

Run from the repo root. Dashboard settings, preview deploys and Vercel environment variables are outward actions: the owner runs or approves them.

## 0. Gate (FR-001), before writing code

**Passed 2026-11-20.** Speed Insights was already enabled, and production returned Vercel's JavaScript for `/_vercel/speed-insights/script.js` (`200 application/javascript`). The steps below are kept for re-checking.

1. Confirm that Speed Insights is enabled: the Speed Insights tab shows the score panel, not an Enable button.
2. Deploy a preview of current `main` and request the script:

   ```bash
   git switch main && git pull
   npx vercel@65.9.0 deploy                         # preview
   curl -s <preview-url>/_vercel/speed-insights/script.js | head -c 200
   ```

   If curl gets a login page, use `npx vercel@65.9.0 curl` (see the `vercel:access-protected-vercel-deployment` skill). Don't switch protection off.

- **Pass**: the response is JavaScript. Continue.
- **Fail**: the app's HTML (`<!DOCTYPE html>`) comes back. Stop and return to `/speckit-assess-decide slug=speed-insights`.

## 1. Unit tests and full gate

```bash
npm run verify
grep -rl "script.debug.js" frontend/dist/assets || echo "no debug script path in build"
```

- **Unit tests**: mode resolution (server and client), `visitLabel`, the index metas, `stripUrl` on both event shapes, and `privacyCopy` for all four combinations. See [contracts/index-html-meta.md](contracts/index-html-meta.md).
- **Build grep**: a match is acceptable only if the debug path sits in an unreachable development branch. Confirm that by reading the matched code once. The hosted check in step 4 is decisive.

## 2. Local runs are silent (FR-003, FR-013, SC-004, SC-005)

```bash
for s in scripts/e2e/*.sh; do [ "$(basename "$s")" = lib.sh ] || "$s" || exit 1; done
```

- Every existing check passes, with no new `E2E_ALLOW_ERRORS`.
- With `npm run dev`, the page has no `speed-insights` metas and makes no request to `/_vercel/` or `va.vercel-scripts.com`.

## 3. Notice (FR-011, FR-012)

```bash
scripts/e2e/privacy-notice.sh
```

It checks [contracts/privacy-notice-ui.md](contracts/privacy-notice-ui.md): three copy variants plus none, one line at 375 px, all six themes, with and without saved places, and zero measurement requests. Then the owner approves the copy. Run an `impeccable` pass only if the line no longer fits on one line.

## 4. Hosted check (US1, US2, FR-007)

1. Vercel → Settings → Environment Variables: set `SPEED_INSIGHTS=on` for Production and Preview.
2. Deploy the feature branch as a preview. Wait more than 5 minutes so the instance idles out, then load it in a browser. Check that:
   - `<meta name="speed-insights-visit" content="cold">` is present;
   - one `/_vercel/speed-insights/script.js` request carries `data-route="/cold"`;
   - there are no console errors.

   Reload at once: the meta is now `warm` (SC-002). Repeat once more (2 of 2).
3. Vercel → Speed Insights, environment **Preview**:
   - Readings appear within a few minutes to hours.
   - Check whether the free tier shows a per-route (`/cold`, `/warm`) view.
   - Record the answer in `docs/deployment.md` (FR-007).
4. Set `SPEED_INSIGHTS=off` for Preview and redeploy. Check that there is no script request, and that the notice shows the visits-only line (FR-004). Restore `on`.
5. Merge to `main` (CI deploys). Within 7 days, Production shows a score once at least one phone and one laptop visit have happened (SC-001).

## 5. Lab baseline (FR-014, SC-003)

1. Run `curl -s -o /dev/null https://lepak-weather.vercel.app/` to wake the instance.
2. Within 4 minutes, run pagespeed.web.dev 3 times for **Mobile** and 3 times for **Desktop**.
3. Record the medians in `docs/deployment.md` → Speed Insights → Lab baseline, with the date: score, FCP, LCP, TBT, CLS, Speed Index and TTFB.

## 6. Docs (FR-015, SC-008)

`docs/deployment.md` must have:
- the `SPEED_INSIGHTS` row;
- a Speed Insights section covering where to look, cold vs warm, what the free tier shows and hides, the 10,000-event rolling 30-day shared allowance and the pause of at least 14 days, the lab procedure and baseline, and the off switch (dashboard-only disabling leaves the app requesting the script).

`docs/architecture.md` gets one sentence, and `docs/testing.md` lists the extended `privacy-notice.sh`.
