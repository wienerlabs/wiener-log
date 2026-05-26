# Security Policy

## Supported Versions

WienerLog is pre-1.0. During the build-out phases only the latest commit on
`main` receives security updates. Once v1.0.0 ships, the most recent two
minor releases will be supported.

| Version | Supported |
| ------- | --------- |
| `main` | yes |
| pre-1.0 tagged releases | no |

## Reporting a vulnerability

Please do **not** open a public issue for security reports.

Send a detailed report to **security@wienerlabs.xyz** (PGP key fingerprint
`E3C4 7D37 7E6B 2960 119C 5FFD E3B9 D276 981B 45C0`). Include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, including code, command lines, and inputs.
- Affected commit SHA or release tag.
- Your name and a way to credit you (or a request for anonymity).

You will receive an acknowledgement within 48 hours. We aim to disclose and
patch within 14 days for high-severity issues and 60 days for lower-severity
issues. Coordinated disclosure timelines are negotiable for complex cases.

## Scope

In scope: the WienerLog code in this repository, default deployment
configurations under `infra/`, and supply chain (Cargo dependencies, GitHub
Actions, container images).

Out of scope: third-party services we integrate with (Anthropic, GitHub,
Solana RPC), the Hetzner host environment beyond what `infra/hetzner/`
provisions, and social engineering of maintainers.

## Hall of fame

Recognized researchers will be listed in `docs/security/hall-of-fame.md`
after a fix lands, with their consent.
