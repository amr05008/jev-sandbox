# 02: Reasons to care

[Results →](RESULTS.md)

**Question:** experiment 01 left 11 of 23 needs-attention emails uncertain.
Can separate yes/no questions (Nouls) about *why an email matters*, combined
in code, resolve more of them without calling important mail routine?

**Items:** experiment 01's 129 emails, unchanged (`../01-email-triage/data/`).
The reference is the baseline LLM's judgment, not ground truth.

**Rule, fixed before the first run:** flag if any reason ≥ 0.5; routine if
every reason < 0.2; otherwise uncertain. The model never sees the rule.

**Variants:** with and without `--context` (the dataset's `recipient.json`
added to state), so 01 and 02 together form a 2×2: question shape × personal
context.

## Run

```sh
node --env-file=.env experiments/02-reasons-to-care/run.ts                   # fixtures
node --env-file=.env experiments/02-reasons-to-care/run.ts --real            # gitignored
node --env-file=.env experiments/02-reasons-to-care/run.ts --real --context
```
