# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately through [GitHub's vulnerability reporting form](https://github.com/kjanat/setup-zig/security/advisories/new).

Include the affected action version or commit SHA, runner operating system and architecture, relevant workflow configuration, reproduction steps, and the potential impact. Remove tokens, credentials, and other private data from logs and examples.

Keep vulnerability details private while the report is investigated and a fix is prepared. Public issues are suitable for ordinary bugs and questions that do not expose a security vulnerability.

## Supported versions

Security fixes target the latest release on the current major version. Upgrade older versions to receive fixes. Reports affecting `master` are also welcome.

## Scope

This policy covers the action's source code, published bundles, dependency use, download and signature verification, cache handling, and release workflows.

Report vulnerabilities in the Zig compiler itself to the Zig project through its own reporting channels. If a compiler vulnerability also exposes a weakness in this action, report the action-specific impact here.
