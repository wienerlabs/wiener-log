# Runbooks

Operational runbooks for WienerLog. Each runbook follows the
structure:

1. **When to use**
2. **Preconditions**
3. **Steps**
4. **Verification**
5. **Rollback**

## Live runbooks

| Runbook                                              | Scope                                              |
| ---------------------------------------------------- | -------------------------------------------------- |
| [deploy.md](./deploy.md)                             | Shipping a new image tag to Hetzner.               |
| [backup.md](./backup.md)                             | Postgres backup + restore (nightly + manual).      |
| [incident.md](./incident.md)                         | Triage and recovery from a production incident.    |
| [monitoring.md](./monitoring.md)                     | Reading and extending Grafana + Loki + Prometheus. |
| [llm-cost.md](./llm-cost.md)                         | Responding to LLM spend ceiling breaches.          |
| [webhook-rotation.md](./webhook-rotation.md)         | Rotating webhook secrets, API keys, DB password.   |

## Planned runbooks

| Runbook                                  | Phase    |
| ---------------------------------------- | -------- |
| Synthesis pipeline replay                | Phase 1  |
| Solana checkpoint failure recovery       | Phase 4  |
| Hetzner host rebuild from cold           | Phase 4  |
| Local development bootstrap (operator)   | Phase -1 |
