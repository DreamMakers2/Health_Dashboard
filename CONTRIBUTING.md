# Contributing to Health Dashboard

Contributions should preserve the project's local-first behavior, simple deployment model, and privacy boundary.

## Before making changes

1. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [SECURITY.md](SECURITY.md), and [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).
2. Do not use real health records, names, email addresses, hostnames, internal URLs, API credentials, machine-specific paths, or other identifying data in fixtures, screenshots, examples, commits, or documentation.
3. Keep `data/` untracked. It may contain body metrics and workout history.
4. Avoid adding runtime dependencies unless they are materially necessary; the current server has no package dependency or package manager requirement.

## Development workflow

Create a focused branch and keep changes small enough to review. The repository does not currently include an automated test suite, so every code change requires syntax checks and an explicit smoke test.

Run at minimum:

```bash
node --check server.js
node --check app.js
```

Then start the server:

```bash
node server.js
```

Verify the relevant behavior at `http://127.0.0.1:3000`.

## Smoke-test checklist

- Confirm `GET /api/state` returns JSON.
- Confirm `GET /api/config` returns JSON.
- Confirm the dashboard loads without uncaught JavaScript errors.
- If state handling changed, create a temporary workout/metric entry, reload, and confirm persistence.
- If config handling changed, change a reversible setting and confirm it persists.
- If calendar/progress logic changed, test both a scheduled date and a custom date.
- Confirm no populated `data/` files are staged for commit.
- Review the diff for secrets and environment-specific identifiers.

## Code and documentation expectations

- Prefer browser/Node platform APIs over new dependencies when practical.
- Keep API and storage behavior consistent with [docs/API.md](docs/API.md).
- Update setup/security/requirements documentation whenever a change alters deployment behavior.
- Do not make compatibility or hardware claims without evidence.
- Avoid medical claims; calorie calculations and progress summaries are software estimates.

## Pull requests

Describe the problem, the behavior change, how it was verified, and any privacy/security implications. Include screenshots only when they contain synthetic data and no identifying browser, account, filesystem, or host information.

By contributing, you agree that your contribution is provided under the repository's license terms in [LICENSE](LICENSE).
