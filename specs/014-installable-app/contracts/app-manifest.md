# Contract: App Manifest and Head Tags

## `GET /manifest.webmanifest`

- **Status** `200`, `Content-Type: application/manifest+json`, `Cache-Control: no-cache`.
- **Body** (exact keys; values fixed):

```json
{
  "id": "/",
  "name": "Lepak",
  "short_name": "Lepak",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#202a36",
  "background_color": "#202a36",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- No `description`, `screenshots`, `shortcuts`, `share_target` or `related_applications` in step A.

## Icon files

| Path | Size | Notes |
|---|---|---|
| `/icons/icon-192.png` | 192×192 | `any`, PNG |
| `/icons/icon-512.png` | 512×512 | `any`, PNG |
| `/icons/icon-maskable-512.png` | 512×512 | Full-bleed `#202a36` background; artwork inside the central 80% circle |
| `/icons/apple-touch-icon.png` | 180×180 | Opaque, with no transparent pixels |
| `/favicon.svg` | vector | Tab icon |

Each returns `200` with its image type. A missing file would fall through to `index.html` with 200, so checks MUST assert the `Content-Type`, not only the status.

## Head tags added to `frontend/index.html`

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#202a36" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-title" content="Lepak" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

- `<title>` stays `Weather` (spec Assumptions: the page title is unchanged).
- `renderIndexHtml` inserts its runtime `<meta>` tags before `</head>`, after these tags, and leaves them intact.
