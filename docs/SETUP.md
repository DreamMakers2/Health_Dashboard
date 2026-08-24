# Setup

This guide describes the setup path supported by the current repository. It does not assume a package manager because the project has no `package.json` and no third-party runtime package dependency.

## 1. Check requirements

Read [REQUIREMENTS.md](REQUIREMENTS.md). You need a Node.js runtime, a modern browser, and write access to the repository directory. The exact Node.js version originally used to develop the project is not recorded, so no exact tested version is claimed.

Verify Node.js is available:

```bash
node --version
```

## 2. Obtain the project

Clone the repository and enter its directory:

```bash
git clone <your-repository-url>
cd Health_Dashboard
```

If you rename the repository/directory, no application code depends on the directory name.

## 3. Review the default configuration

`config.json` contains the checked-in defaults for:

- recurring workout weekdays;
- number of past/future weeks shown;
- dark mode;
- exercise groups;
- exercise names;
- calorie-estimation formulas.

The checked-in file is deliberately generic. You can edit it before first launch or change settings from the dashboard after startup. Dashboard settings are written back to `config.json`.

Formula variables used by the current UI are:

- `bw` — body weight in kilograms;
- `load` — external exercise load in kilograms.

Review formulas before relying on the resulting estimates. They are not clinical measurements.

## 4. Start the server

### Cross-platform Node.js path

From the repository directory:

```bash
node server.js
```

The default bind is:

- host: `127.0.0.1`
- port: `3000`

Open:

```text
http://127.0.0.1:3000
```

### Windows convenience launcher

Run:

```text
launch_dashboard.bat
```

The launcher:

1. sets port `3003`;
2. looks for Node.js in `C:\Program Files\nodejs\node.exe` and then on `PATH`;
3. can fall back to WSL if Windows Node.js is unavailable;
4. checks whether port `3003` is already in use;
5. starts the server when needed;
6. polls `/api/state` up to 15 times;
7. attempts to open the configured browser.

Open `http://localhost:3003` manually if browser detection fails but the server is running.

## 5. Optional host/port configuration

The server reads `HOST` and `PORT` from the environment.

Unix-like shells:

```bash
HOST=127.0.0.1 PORT=3005 node server.js
```

Windows Command Prompt:

```bat
set HOST=127.0.0.1
set PORT=3005
node server.js
```

Do not set `HOST=0.0.0.0` merely for convenience. The application has no authentication. If you intentionally expose it beyond loopback, read [../SECURITY.md](../SECURITY.md) first and add independent network/authentication controls.

## 6. First-run data files

At server startup, the application creates `data/` if it does not exist. It then creates empty state files when necessary:

- `data/health.json`
- `data/health.backup.json`

These files are ignored by Git because they can contain personal health data.

The browser may also keep recovery copies in `localStorage`.

## 7. Verify the server

With the server running, verify the state endpoint:

```bash
curl http://127.0.0.1:3000/api/state
```

Verify the configuration endpoint:

```bash
curl http://127.0.0.1:3000/api/config
```

Both should return JSON.

Then open the browser UI and verify that schedule cards, metric entry, settings, progress range controls, and calendar interactions render.

## 8. Configure the dashboard as your own

Use Settings to select workout weekdays, visible weeks, theme, profile height, exercises, and formulas. Enter body metrics from the metrics panel.

The current implementation contains a fixed scheduling baseline in `app.js`:

```js
const START_DATE = '2025-12-15';
```

That value affects which dates are considered by schedule/progress functions. It is not exposed in `config.json` today. If you change it, re-run the syntax checks and test calendar/progress behavior. This documentation preserves that implementation detail instead of inventing a configurable feature that does not exist.

## 9. Backup and migration

To move an existing installation:

1. stop the server;
2. copy the `data/` directory to secure storage;
3. copy `config.json` if you want the same workout defaults;
4. copy the repository/application files to the destination machine;
5. restore `data/` and `config.json` before startup;
6. start the server and verify `/api/state` and `/api/config`.

Treat the copied `data/` directory as sensitive health information.

## 10. Reset local data

Stop the server before resetting. Back up anything you want to retain, then remove `data/health.json` and `data/health.backup.json`. The server will recreate an empty state on next startup.

To clear browser-side recovery copies as well, clear site storage for the local dashboard origin in your browser.

## 11. Developer syntax checks

The repository has no automated test suite. Use at least:

```bash
node --check server.js
node --check app.js
```

See [../CONTRIBUTING.md](../CONTRIBUTING.md) for smoke testing and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for code-backed failure cases.
