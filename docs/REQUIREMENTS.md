# Requirements

This document separates repository evidence from assumptions. Where the repository does not record a tested version or hardware configuration, it says so rather than inventing a compatibility claim.

## Hardware actually used and verified

**Not recorded in the repository or reachable development history reviewed for this release.**

The repository does not contain reliable evidence identifying the development/test machine's CPU model, instruction-set architecture, RAM capacity, storage device/capacity, GPU, network interface, peripherals, or other hardware. Therefore no exact hardware configuration can truthfully be presented as verified.

## Minimum hardware requirements

No quantitative minimum CPU, RAM, or storage benchmark is present in the repository, and no benchmark was available to support a defensible minimum specification.

Evidence-supported constraints are:

| Component | Evidence-supported requirement |
| --- | --- |
| CPU / architecture | Must be capable of running a supported Node.js build and a modern browser. The project contains no native addon or compiled project component, but architecture support ultimately depends on the Node.js/browser builds you install. |
| RAM | No measured minimum is available. Memory must be sufficient for Node.js, the browser, and the in-memory JSON state being processed. |
| Storage | No measured minimum is available. Storage is required for the repository, Node.js/browser installation, `config.json`, and growing JSON state/backup files under `data/`. Runtime data size is workload-dependent and not bounded by the project. |
| GPU / accelerator | No dedicated GPU or accelerator API is used by the project. Browser rendering may use platform acceleration automatically, but the repository provides no dedicated GPU requirement. |
| Networking | Loopback networking is required for browser-to-server communication. Internet access is not required for the Node.js APIs or local data storage. The existing stylesheet references Google Fonts, but the server's Content Security Policy blocks non-local font/style origins, so system fallback fonts are used when served by the hardened server. |
| Peripherals / interfaces | No camera, microphone, GPS, Bluetooth, serial, USB, or other hardware peripheral is required by the code. The server explicitly disables camera, microphone, and geolocation through `Permissions-Policy`. |

## Recommended hardware

The repository contains no performance measurements from which to derive CPU core-count, RAM, storage, or GPU recommendations. A recommendation would therefore be speculative. Use hardware comfortably capable of running your chosen maintained Node.js runtime and browser, then measure your own state-file size and responsiveness.

## Software actually used or evidenced

### Operating system / environment

The exact development operating system is not recorded in commit metadata or configuration.

The repository does contain a Windows launcher, `launch_dashboard.bat`, which explicitly integrates with:

- Windows Command Prompt batch syntax;
- `C:\Program Files\nodejs\node.exe` as one Node.js lookup path;
- the Windows `PATH` via `where node`;
- PowerShell `Invoke-WebRequest`;
- `netstat`;
- Windows default-browser registry associations;
- optional WSL (`wsl.exe`) fallback.

The direct `node server.js` path uses Node.js standard-library APIs and is intended to be operating-system independent. No automated cross-platform compatibility matrix is present, so this is an implementation observation rather than a verified OS support claim.

### Node.js

Node.js is required. The server uses only built-in modules:

- `http`
- `fs`
- `path`
- `url`

The repository **does not record the exact Node.js version originally used or a tested version range**. There is no `.nvmrc`, `.node-version`, `package.json`, lock file, CI matrix, or other version pin. Do not present a specific Node version as verified until the project establishes one and tests it.

### Package manager and dependencies

No package manager is required by the current project. There is no `package.json`, and the server/client import no third-party JavaScript package at runtime.

### Browser

A modern browser is required. The client code relies on browser features including:

- DOM APIs and event listeners;
- `fetch`;
- `localStorage`;
- `navigator.sendBeacon` when available;
- `Blob`;
- HTML form controls;
- CSS Grid/Flexbox/custom properties;
- Canvas-based chart rendering in the existing client code.

No specific browser/version compatibility matrix is recorded.

### Drivers and firmware

No project-specific driver or firmware requirement is present.

### External tools

For normal cross-platform startup, only Node.js and a browser are required.

For the Windows convenience launcher, the script uses built-in/common Windows tools described above. WSL is optional and used only as a fallback when a Windows Node executable is not found.

For development, Git is needed to clone/version the repository. `curl` is used in the setup documentation for endpoint verification but is not required by the application itself.

## Filesystem permissions

The process must be able to:

- read the repository's static files;
- create the `data/` directory;
- create/replace `data/health.json` and `data/health.backup.json`;
- create/replace `config.json` and its temporary write file.

A read-only checkout will not support normal persistence.

## Ports

- Direct `node server.js`: default port `3000`.
- `launch_dashboard.bat`: sets port `3003`.
- `PORT` can override the server port.
- `HOST` defaults to `127.0.0.1` in the hardened server.

The selected port must be available to the local process.
