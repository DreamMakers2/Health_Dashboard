# Troubleshooting

The repository does not contain a historical issue log describing every problem encountered during development. This page therefore documents only failure modes and recovery behavior that are explicitly present in the current code and launcher.

## `Node.js not found on Windows and WSL is unavailable.`

Source: `launch_dashboard.bat`.

The launcher first checks `C:\Program Files\nodejs\node.exe`, then searches `PATH` with `where node`, then tries WSL.

Fix:

1. confirm `node --version` works in a terminal;
2. install/configure Node.js if it does not;
3. ensure the executable is on `PATH`, or use the direct `node server.js` startup path;
4. use WSL only if Node.js is installed inside that WSL environment.

## `Port 3003 already in use. Checking server...`

Source: `launch_dashboard.bat`.

The launcher checks for a listener on port `3003`. If the port is occupied, it does not immediately start another server; it probes `/api/state` instead.

Fix:

- if an existing Health Dashboard instance is running, use it;
- otherwise identify the process using `3003` or start Health Dashboard manually on another port with `PORT`.

Example:

```bash
PORT=3005 node server.js
```

## `Server did not start or is not responding`

Source: `launch_dashboard.bat`.

The launcher makes up to 15 one-second-spaced requests to `/api/state` before failing.

Fix:

1. run `node server.js` in a visible terminal to see syntax/runtime errors;
2. verify the selected port is free;
3. verify the process can write `data/` and `config.json`;
4. request `/api/state` manually.

## Browser opens but the dashboard does not persist changes

Persistence requires write access to the checkout directory because the server writes `data/health.json`, `data/health.backup.json`, and `config.json`.

Fix:

- run from a writable location;
- check filesystem permissions;
- verify `GET /api/state` and `GET /api/config` return JSON;
- check the server terminal for errors.

## Corrupt or invalid `health.json`

Source: `server.js`.

If reading/parsing the primary state throws, `readState()` returns a default in-memory state. It does not automatically prove that the existing file is recoverable.

Recovery:

1. stop the server;
2. preserve copies of both state files before editing;
3. inspect `data/health.backup.json`;
4. restore a valid JSON copy as `data/health.json` when appropriate;
5. restart and verify `/api/state`.

Do not post a real health-data file publicly while requesting help.

## Invalid `config.json`

Source: `server.js`.

If reading/parsing configuration fails, the server returns normalized built-in defaults. Preserve the invalid file before repairing it if you need to recover custom exercises/formulas.

## Another device cannot connect to the dashboard

The hardened server intentionally binds to `127.0.0.1` by default, so other devices cannot connect.

If remote access is truly required, you can choose a non-loopback `HOST`, but the application has no authentication. Read [../SECURITY.md](../SECURITY.md) and add independent authentication/TLS/network controls before doing so.

## Fonts look different from an earlier local copy

The existing stylesheet contains a Google Fonts `@import`, while the hardened server Content Security Policy allows only same-origin styles/fonts. The browser therefore falls back to the declared system font stack. This removes a third-party runtime fetch but can change typography slightly.

## Syntax verification

For parse errors after editing JavaScript, run:

```bash
node --check server.js
node --check app.js
```

These checks verify JavaScript syntax only; they do not replace browser smoke testing.
