# Hetzner deployment

Production deployment configuration for WienerLog on Hetzner Cloud. Wired
in Phase 4 once the web surface and Solana checkpoint land. Phase -1 ships
this directory empty so the layout commitment is on record.

## Planned contents

- `cloud-init.yml` — first-boot provisioning (Docker, ufw, fail2ban, user).
- `compose.prod.yml` — production overlay over `infra/docker-compose.yml`.
- `caddy/Caddyfile` — TLS termination via Caddy with Cloudflare DNS challenge.
- `runbooks/` — host rebuild, certificate rotation, backup restore.

Until then this README is the authoritative pointer that the production
deployment will live here.
