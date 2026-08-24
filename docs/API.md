# API

The API is a small same-origin JSON interface implemented directly in `server.js`. There is no authentication. By default the server binds to `127.0.0.1` specifically so these endpoints remain local to the machine.

Default base URL:

```text
http://127.0.0.1:3000
```

The Windows launcher uses port `3003` instead.

## `GET /api/state`

Returns normalized application state.

Shape:

```json
{
  "settings": {
    "today": "",
    "lastAutoToday": "",
    "extraPastWeeks": 0,
    "extraFutureWeeks": 0,
    "heightCm": ""
  },
  "workouts": {},
  "metrics": {},
  "customDates": [],
  "lastSaved": null
}
```

The browser client may add additional settings fields (for example its progress-range preference); `normalizeState` preserves incoming settings by merging them with defaults.

## `POST /api/state`

Accepts JSON state, normalizes it, replaces the primary state, and writes a backup.

Response: normalized state JSON.

Invalid JSON: `400` with:

```json
{"error":"Invalid JSON"}
```

Other methods: `405`.

## `POST /api/import`

Accepts a state-shaped JSON object and merges it into current state.

Current merge behavior:

- if current state is empty, incoming normalized state replaces it;
- workouts are copied only for dates not already present;
- metrics are copied only for dates not already present;
- custom dates are unioned and sorted;
- selected top-level settings/timestamps are filled only when the existing value is absent.

This endpoint is designed for migration/recovery, not conflict-aware synchronization.

Response: merged state JSON.

## `GET /api/config`

Returns normalized `config.json`.

Current fields:

```json
{
  "scheduleDays": [1, 3, 5],
  "defaultPastWeeks": 1,
  "defaultFutureWeeks": 2,
  "darkMode": false,
  "exerciseGroups": {
    "armsBack": {
      "label": "Arms / Back",
      "exercises": []
    },
    "coreAbs": {
      "label": "Core / Abs",
      "exercises": []
    }
  }
}
```

Each exercise contains `id`, `label`, `hasWeight`, and `kcalFormula` after normalization. `hasWeight` is derived from whether the formula references the token `load`.

## `POST /api/config`

Accepts JSON configuration, normalizes it, and replaces `config.json` atomically via a temporary file plus rename.

Normalization includes:

- schedule days restricted to integer weekday IDs `0` through `6`;
- duplicate weekday IDs removed;
- past/future weeks clamped to `0..52`;
- known exercise-group structure normalized;
- duplicate/empty exercise IDs removed;
- missing formulas replaced with the default weighted formula.

Invalid JSON: `400`.

Other methods: `405`.

## Static routes

The server serves only:

- `/`
- `/index.html`
- `/styles.css`
- `/app.js`

Other paths return `404`.

## Request size

`readBody` stops accepting a request after its accumulated string exceeds `1e7` characters and destroys the request. Because the connection is destroyed, a client can observe a connection error instead of a normal JSON error body.

## Security headers

Responses from the hardened server include no-store caching and restrictive browser headers, including a Content Security Policy. See [../SECURITY.md](../SECURITY.md).

## No stability/versioning guarantee

The API has no version prefix and no formal compatibility policy in the current repository. Consumers should be treated as coupled to the repository revision unless a future versioning policy is added.
