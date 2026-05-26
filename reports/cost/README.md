# LLM cost reports

Daily ledger of LLM spend during development. One file per day named
`YYYY-MM-DD.md`. Per the mandate:

- Hard daily ceiling: **$15 USD**
- Rolling 7-day ceiling: **$75 USD**

Exceeding either triggers Stop condition §11.4 in the WIENERLOG mandate.

## Format

```markdown
# YYYY-MM-DD

## Spend by model

| Model | Input tokens | Output tokens | USD |
| ----- | ------------ | ------------- | --- |
| claude-opus-4-7 | ... | ... | ... |
| claude-sonnet-4-6 | ... | ... | ... |
| claude-haiku-4-5 | ... | ... | ... |

## Spend by purpose

| Purpose | USD |
| ------- | --- |
| synthesis | ... |
| triage | ... |
| embedding | ... |

## Notes

Anything surprising. Rate limit hits. Prompt failures.
```
