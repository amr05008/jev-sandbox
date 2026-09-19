# 02-reasons-to-care

**Question:** experiment 01 asked one two-way Choice and left 11 of 23
needs-attention emails in `uncertain`. Does one narrow Noul per *reason an
email could matter*, combined in code, decide more of them outright?

**Items:** experiment 01's, unchanged (`../01-email-triage/data/`). Same
labels, same caveats: `expected` is agreement with the baseline LLM
classifier, not truth.

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
