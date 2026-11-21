# Contract: cron-job.org → GitHub workflow dispatch

The one request the cron-job.org job sends every 15 minutes.

```http
POST https://api.github.com/repos/chuan77/AIxTech-SG-Weather/actions/workflows/taxi-rain-study.yml/dispatches
Accept: application/vnd.github+json
Authorization: Bearer <fine-grained PAT>
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json

{"ref":"main"}
```

| Response | Meaning | cron-job.org should |
|---|---|---|
| `204 No Content` | run queued | record success |
| `401` / `403` | token expired, revoked or missing the Actions permission | fail and send an email |
| `404` | wrong repo or workflow name, or the token can't see the repo | fail and send an email |
| `422` | `ref` doesn't exist, or the workflow lost its `workflow_dispatch:` trigger | fail and send an email |

## Rules the workflow keeps

- `on.workflow_dispatch` MUST stay in `.github/workflows/taxi-rain-study.yml` until the study ends.
- The run uses the workflow file **on `main`**. Changes such as the slot check take effect only after they merge.
- There are no inputs. The dispatch body carries only `ref`.
- The token is never committed, logged or put in a repository secret. It lives only in the cron-job.org job's headers.
