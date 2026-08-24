# Public Release Checklist

Use this checklist before treating any revision as safe for public distribution. A clean working tree alone is not sufficient; reachable Git history and metadata must also be reviewed.

## Repository state

- [ ] Working tree contains only files required by the project or public documentation.
- [ ] `data/` and other runtime health exports are absent and ignored.
- [ ] No debug dumps, temporary files, editor metadata, logs, generated junk, or obsolete backups are tracked.
- [ ] Configuration contains generic defaults only; no personal workout/profile values are intentionally published.
- [ ] README/setup/requirements/API/security documentation matches the code in the candidate revision.
- [ ] All documentation links resolve within the repository.

## Secrets and identifying information

Search both the candidate tree and all retained Git refs for:

- [ ] passwords, tokens, API keys, credentials, private keys, cookies, auth headers;
- [ ] non-placeholder IP addresses;
- [ ] DNS/domain names and private/internal URLs;
- [ ] MAC addresses;
- [ ] hostnames, machine names, internal service names;
- [ ] GPS coordinates/location data;
- [ ] usernames and email addresses;
- [ ] identifying filesystem paths;
- [ ] personal health data or profile values;
- [ ] real environment-specific identifiers in examples/configuration.

Generic placeholders such as `localhost`, `127.0.0.1`, `<your-repository-url>`, and standard program-installation paths are acceptable when they do not identify a real environment.

## History review

Recommended local commands/tools (run from a full clone that includes all refs):

```bash
git fetch --all --tags --prune
git branch -a
git tag -l
git log --all --format=fuller
```

Use a secret scanner capable of scanning Git history, and supplement it with targeted searches for identifiers relevant to this repository.

If a secret or personal identifier appears in reachable history, remove/replace it in history rather than merely deleting it in a new commit. Prefer targeted rewriting. If targeted rewriting cannot be made reliable, rebuilding a clean root history is safer than retaining uncertain private history.

After rewriting:

```bash
git fsck --unreachable
git log --all --format=fuller
```

Search again for every removed value. Inspect all remaining branches and tags. Delete obsolete refs that retain the old history, then push rewritten refs with lease protection where the normal Git client supports it.

## Commit metadata

- [ ] Author/committer names and email addresses in retained commits are intentionally public or have been rewritten to a non-identifying identity.
- [ ] Commit messages contain no personal paths, internal names, credentials, or private incident details.

## Functional verification

- [ ] `node --check server.js` passes.
- [ ] `node --check app.js` passes.
- [ ] Server starts on `127.0.0.1` and the chosen port.
- [ ] `/api/state` returns JSON.
- [ ] `/api/config` returns JSON.
- [ ] Dashboard loads and basic workout/metric/config interactions work with synthetic data.
- [ ] Data persists to ignored `data/` files.
- [ ] Reset/backup/migration steps in `docs/SETUP.md` are accurate.

## Security review

- [ ] Server defaults to loopback-only binding.
- [ ] No documentation suggests exposing the unauthenticated API directly to an untrusted network.
- [ ] Runtime health data locations are documented as sensitive.
- [ ] Browser `localStorage` backup behavior is documented.
- [ ] Security headers in documentation match `server.js`.

## Licensing/public-project files

- [ ] `LICENSE` present.
- [ ] `NOTICE` present.
- [ ] `CONTRIBUTING.md` present.
- [ ] `SECURITY.md` present.
- [ ] Requirements/setup/architecture/API/troubleshooting docs present and internally consistent.
- [ ] License wording is reviewed by the project owner for the intended commercial restriction.

## Visibility

Repository visibility is an independent final decision. Do not change visibility as part of this checklist unless the repository owner explicitly chooses to do so after reviewing the sanitized history and candidate state.
