# Security Policy

## Security model

Health Dashboard is a local-first application for a trusted user on a trusted machine. It is **not** an authenticated multi-user service.

The server binds to `127.0.0.1` by default. This is a deliberate boundary: the JSON APIs can read and modify workout, body-metric, profile, and configuration data without authentication.

Do not expose the server directly to an untrusted network. Setting `HOST=0.0.0.0` or another non-loopback address broadens the attack surface and should only be done with an appropriate reverse proxy, authentication layer, TLS termination, host firewall, and access policy that you configure independently.

## Sensitive data locations

Runtime data may include sensitive health information:

- `data/health.json`
- `data/health.backup.json`
- browser `localStorage` entries used for client and configuration backup

The `data/` directory is ignored by Git. Keep it that way. Do not attach populated state files to public issues or pull requests.

`config.json` is intended for non-secret workout defaults. Do not place credentials, private URLs, personal identifiers, or secrets in it.

## Server hardening present in this repository

The server currently:

- defaults to a loopback-only bind;
- sends `X-Content-Type-Options: nosniff`;
- sends `Referrer-Policy: no-referrer`;
- sends a same-origin `Cross-Origin-Resource-Policy`;
- disables camera, microphone, and geolocation through `Permissions-Policy`;
- sends a restrictive Content Security Policy;
- sends `Cache-Control: no-store` for served application/API content;
- rejects request bodies after approximately 10,000,000 characters by terminating the request.

These measures do not replace authentication if the service is exposed beyond localhost.

## Supported versions

This repository does not currently maintain multiple supported release lines. Security fixes should be applied to the latest maintained branch/revision.

## Reporting a vulnerability

Do not publish exploit details, credentials, personal health data, or other sensitive material in a public issue.

Use GitHub's private security reporting/advisory mechanism for the repository if it is available. If private reporting is not available, open a minimal public issue requesting a private maintainer contact channel without including vulnerability details.

Include the affected revision, reproduction conditions, impact, and a minimal proof of concept that uses synthetic data.

## Repository-history hygiene

Before public release, inspect all branches, tags, and reachable commit history for secrets and identifying metadata. Removing a file in a later commit is not sufficient when the sensitive blob or commit metadata remains reachable. See [docs/PUBLIC_RELEASE_CHECKLIST.md](docs/PUBLIC_RELEASE_CHECKLIST.md).
