# LLM cost ceiling runbook

How to react when LLM spend approaches or breaches the configured
ceiling.

## When to use

- Grafana alert `wlog-llm-cost-budget-90` fires
  (`wlog_llm_cost_usd_today > 13.5`).
- `wlog cost` shows daily spend above 90% of the configured daily
  cap.
- Rolling 7-day spend exceeds `WLOG_LLM_ROLLING_USD_CAP` (default
  $75).
- A surprise invoice email arrives from Anthropic or OpenAI.

## Preconditions

- Cost ledger schema (`llm_calls` table) is live; daemon writes
  one row per LLM call.
- `wlog cost` subcommand available locally and on the host.
- Anthropic and OpenAI console credentials at hand.
- `daemon.env` contains `WLOG_LLM_DAILY_USD_CAP`,
  `WLOG_LLM_ROLLING_USD_CAP`, `WLOG_LLM_CIRCUIT_BREAKER` (default
  `true`).

## Steps

### 1. Confirm the breach

```bash
ssh wlog@<host> -p 2222
cd ~/wienerlog
docker exec wlog-prod-daemon-1 wlog cost --days 7
docker exec wlog-prod-daemon-1 wlog cost --today --json | jq
```

Cross-check against Grafana:
- `WienerLog Overview → LLM USD today`.
- `WienerLog Overview → LLM USD by model (7d)`.

### 2. Identify the spike source

```sql
-- inside docker exec wlog-prod-postgres-1 psql -U wlog
SELECT
    date_trunc('hour', created_at) AS bucket,
    model,
    prompt_version,
    count(*)            AS calls,
    sum(prompt_tokens)  AS prompt_tok,
    sum(output_tokens)  AS output_tok,
    round(sum(usd)::numeric, 4) AS usd
FROM llm_calls
WHERE created_at > now() - interval '24 hours'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, usd DESC;
```

Typical causes:

- **Prompt regression**: a new template version pushes more tokens
  per call.
- **Hot loop**: an event source flooding (Git hook firing 10x
  expected, GH bot opening 200 PRs).
- **Embeddings storm**: a backfill kicked off and embedded everything
  uncached.
- **Cache miss**: `cache_control` ephemeral block dropped from the
  prompt, killing the prompt-cache discount.
- **Wrong model**: a config bump accidentally moved synthesis from
  `claude-haiku-4-5` to `claude-opus-4-5`.

### 3. Mitigate

#### Immediate brake

The circuit breaker is automatic when
`WLOG_LLM_CIRCUIT_BREAKER=true`: once daily spend exceeds the cap,
the engine fails-soft on LLM-bound work (synthesis defers, triage
falls back to rules-only). Confirm:

```bash
curl -fsS http://127.0.0.1:9789/metrics | grep wlog_llm_circuit
```

If for some reason the breaker is off, set it and restart the
daemon:
```bash
sudo sed -i 's/^WLOG_LLM_CIRCUIT_BREAKER=.*/WLOG_LLM_CIRCUIT_BREAKER=true/' /home/wlog/state/daemon.env
sudo systemctl restart wlog-daemon.service
```

#### Throttle a hot source

```bash
docker exec wlog-prod-daemon-1 wlog pause --source <source>
```

Sources: `git`, `cc`, `gh`. The daemon stops consuming that NATS
subject; events queue until you `wlog resume <source>`.

#### Roll back a prompt regression

```bash
git log -- prompts/synthesis_v1/system.tera
# pick the previous commit
git checkout <prev-sha> -- prompts/synthesis_v1
git commit -m "fix: revert synthesis prompt to <prev-sha> after cost regression"
git push origin main
```

Then redeploy (see [deploy.md](./deploy.md)).

#### Raise the cap (only if business-justified)

Edit `daemon.env`:
```
WLOG_LLM_DAILY_USD_CAP=20
WLOG_LLM_ROLLING_USD_CAP=100
```

Restart the daemon. Document the bump in
`docs/cost-ledger.md#cap-history` with a justification.

### 4. Restore service

After the breach is mitigated:
- Resume any paused sources (`wlog resume <source>`).
- Confirm `wlog_llm_cost_usd_today` flattens.
- Verify synthesis output resumes (panel: tasks created per hour).

## Verification

- `wlog cost --today` returns to < 75% of the cap.
- Grafana `WienerLog Overview → LLM USD today` curve flattens
  rather than continuing to climb.
- Synthesis worker latency normalizes (`wlog_synthesis_p95 < 5s`).
- No more pages for `wlog-llm-cost-budget-90` for the rest of the
  UTC day.

## Rollback

- If the throttle starves the system too aggressively (synthesis
  stalls for hours), `wlog resume <source>` and either raise the
  cap or accept the partial output for the day.
- If a prompt rollback breaks evaluation gates, revert the revert
  and ship a fix forward instead.
- The cost ledger itself is append-only; do not delete rows. If
  you need to "reset" the daily spend, wait for UTC midnight (the
  ledger groups by day).
