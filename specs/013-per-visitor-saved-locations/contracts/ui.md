# Contract: UI and browser behaviour

## Visitor key module (`frontend/src/visitorKey.ts`, pure and unit-tested)

| Function | Contract |
|---|---|
| `generateVisitorKey(randomBytes)` | 32 bytes in, 43-character base64url string out. Takes the random source as an argument so tests are deterministic. |
| `isVisitorKey(value)` | `true` only for `^[A-Za-z0-9_-]{43}$`. |
| `getVisitorKey(storage?)` | Returns the stored key if it's valid. Otherwise generates one, stores it under `weather-starter.visitor.key` and returns it. If the storage read or write throws, it keeps the key in module memory for this page (FR-015). It never touches the network. |

`api.ts` `send()` and `deleteLocationOnUnload()` add `X-Visitor-Key: getVisitorKey()` to `/locations*` calls. Nothing else in the store changes: Principle II's single store still holds server state, and it simply receives this visitor's list.

## Screens

| Situation | What the visitor sees |
|---|---|
| First visit, or a new browser or device | The existing empty state (add-location form, town search, "Use my location"). No new prompt or banner (FR-010, SC-005). |
| Return visit, same browser | Their list and stored snapshots. No weather fetch on open (FR-007). |
| Storage blocked | Same as a first visit. Places added this session work and are gone after the tab closes. No error message. |
| Map pins and "Use my location" nearby check | Built from the visitor's own list only, which is automatic because the list comes from `GET /api/locations`. |

## Privacy notice (`PrivacyNotice.tsx`, FR-013)

- The collapsed line stays `Anonymous visit counts · no cookies`. That's still true: the key is in `localStorage` and sent as a header.
- The explanation gains one sentence, appended after the analytics text, in the notice's existing tone and length. Draft: "Places you save are kept on our server under a random code stored only in this browser, so no one else can see them. They're deleted after 90 days without use."
- No new colours or classes. Any styling follows `docs/theming.md` (Principle V); none is expected.
