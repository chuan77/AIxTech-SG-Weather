# Concept: Real-user performance visibility for Lepak Weather

- **Slug**: speed-insights
- **Created**: 2026-11-20
- **Recommended option**: B: Speed Insights, cold and warm visits labelled apart, plus a warm lab baseline

## Options

### Option A: Speed Insights as-is, behind the existing measurement gate

- **Sketch**: Turn on Vercel Speed Insights (free Hobby tier) for hosted deployments only. It follows the same on/off rule as Web Analytics, so local runs, tests and browser checks load nothing. Reported URLs are stripped the same way. The privacy notice is widened to cover performance measurement. The owner then reads one Real Experience Score per device type in the Vercel dashboard, for the last 24 hours or 7 days.
- **Appetite**: small (a day or two, including a preview check).
- **Trade-offs**:
  - **Wins:** the cheapest route; reuses the spec 012 pattern; teaches the full setup on the container; no new data storage.
  - **Sacrifices:** it misses the "separate cold starts" goal. The free tier shows only the combined score with no per-metric view, so a low score can't be told apart as cold start or frontend.
  - **Risks:** at fewer than 5 visitors the score is thin and noisy. The `/_vercel/speed-insights/*` route on the container is untested.
- **Rabbit holes**: chasing a "bad" score that is really cold start; being tempted into Pro plus Speed Insights Plus to see the individual metrics (a non-goal).

### Option B: Option A, plus cold and warm visits labelled apart, plus a warm lab baseline

- **Sketch**: Everything in A, with two additions so cold start and frontend can be seen separately:
  1. Each page load tells Speed Insights whether it was served by a freshly started instance or a warm one. Speed Insights already accepts a page "route" label; on a one-page app that label is otherwise always `/`. The dashboard could then show the score for cold visits and warm visits side by side, if the free tier allows that breakdown.
  2. A short, repeatable lab reading (Lighthouse or PageSpeed Insights against an already-warm deployment, mobile and desktop) gives free per-metric frontend numbers, independent of traffic and plan limits.

  Together, the field score with its cold/warm split and the warm lab baseline let the owner say how much is container wake-up and how much is the frontend.
- **Appetite**: small (a few days). The lab baseline is a recorded procedure, not new tooling.
- **Trade-offs**:
  - **Wins:** meets all four problem goals within the free tier; strong learning value, since it shows field data next to lab data and what each can and can't tell.
  - **Sacrifices:** a little more moving parts than A. The route label is a repurposing of a field meant for page paths.
  - **Risks:** the free tier may not show per-route scores ("breakdowns limited to Great and Needs Improvement entries"). In that case the split falls back to the lab baseline alone, and B becomes A plus a lab procedure. "Fresh instance" is judged per instance, so a request burst that starts several instances counts each first visit as cold. That is acceptable, because those visitors did wait.
- **Rabbit holes**: automating the lab run in CI with budgets and thresholds (a non-goal); adding more labels (device, feature, layer) to the route; trying to make the cold/warm signal exact across instances.

### Option C: Own real-user measurement, stored in the app's database

- **Sketch**: The browser collects the standard Web Vitals itself and sends each one, with a cold/warm flag, to the app's own server, which keeps them in Turso. The owner queries per-metric, per-device, cold/warm figures with no plan limits or retention window.
- **Appetite**: medium (one to two weeks).
- **Trade-offs**:
  - **Wins:** full per-metric detail and a clean cold/warm split; no vendor quota; the most hands-on learning about how RUM works.
  - **Sacrifices:** it builds what Vercel offers for free (a new endpoint, storage, retention, rate limiting, abuse handling and a privacy review). It adds write load to the production database. It doesn't teach Vercel Speed Insights, which was the original ask.
  - **Risks:** a new public write endpoint on a public URL, and storing per-visit device and network data alongside visitor keys.
- **Rabbit holes**: building charts and percentile queries; retention and deletion rules; deduplicating bursts; scoring formulas that try to imitate RES.

### Option D: Do nothing; lab checks only, by hand

- **Sketch**: Skip field measurement. When curious, run PageSpeed Insights or Lighthouse on the public URL.
- **Appetite**: none.
- **Trade-offs**:
  - **Wins:** zero cost, zero privacy change.
  - **Sacrifices:** no real-device data and no learning about Speed Insights. It misses the first two goals.

## Recommendation

**Option B.** The owner framed this as a learning exercise and asked for cold starts to be separated out. A alone can't separate them on Hobby, so it would teach the setup but produce a number the owner can't interpret. C separates them cleanly but rebuilds a free product, adds a public write path and database load, and drifts away from learning Speed Insights. D drops the field data entirely.

B stays small and free and reuses the proven spec 012 gating and privacy pattern. It answers every success metric:
- **Data flows:** field readings from Speed Insights.
- **Cold start separated:** the cold/warm label, or else the warm lab baseline.
- **Hygiene:** the same gate as Web Analytics.
- **Within limits:** about 3–5 events per visit against 10,000 per 30 days, far above current traffic.

Its fallback (if per-route scores aren't shown on Hobby) still leaves the owner with a usable split through the lab baseline.

## Out of Scope (for the recommended option)

- Pro, Speed Insights Plus, Drains or any paid vendor.
- Fixing performance or reducing cold starts.
- Score targets, alerts, CI performance budgets or release gates.
- Automating the lab run. It stays a documented manual procedure.
- Route labels beyond cold/warm (no per-feature or per-layer labels).
- Feature-usage analytics (Web Analytics already covers visits).
- Showing performance figures to visitors.
- Storing any performance data in the app's own database.

## Assumptions to Validate

- Vercel serves `/_vercel/speed-insights/*` in front of the Container preset, as it does `/_vercel/insights/*`. Check with a preview deploy after enabling Speed Insights in the dashboard.
- The free tier lets the owner view the score per route label. If it doesn't, the cold/warm split comes from the lab baseline only.
- The server can tell whether a page load is the first request of a fresh instance cheaply, without affecting response time.
- Using the route label for cold/warm doesn't break scoring or count extra events.
- Vite's production build makes the package load the `/_vercel/...` script rather than the third-party debug script.
- The privacy notice can be widened in a sentence or two. Speed Insights stores country, browser, OS, device type, network speed and element attribution, but no IP, city or cookies.
- Expected traffic stays well under 10,000 events per rolling 30 days (about 2,000–3,300 visits), including anything else on the account.
- A warm lab reading is reproducible enough (same device profile, warmed instance) to serve as a frontend baseline.
