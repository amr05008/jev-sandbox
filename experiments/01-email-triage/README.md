# 01: Email triage

[Results →](RESULTS.md)

**Question:** can Jev triage email from headers alone, compared with an LLM
that also sees a body snippet? How fast and cheap is it?

**Items:** two weeks of inbox headers, matched by message ID to an existing
LLM classifier's labels. `expected` is that label: this measures agreement,
not ground truth. The input supports sender names, but the real-data lookup
returned only addresses and subjects.

**Classes:** `needs-attention`, `routine`, `uncertain`. A small share of mail
is labeled by a rule before the model runs; it carries no model judgment and
is left out.

**Header-only on purpose.** TypeSafe's terms commit to no training on inputs
but state no retention period, so inputs are treated as retained indefinitely.
Bodies stay out. If header-only agreement is poor, that is a finding, not a
reason to widen the input without deciding to.

## Run

```sh
node --env-file=.env experiments/01-email-triage/run.ts          # fixtures
node --env-file=.env experiments/01-email-triage/run.ts --real   # data/real/, gitignored
```

## Data

- `data/fixtures/items.jsonl` — 12 synthetic seed emails on `.example` domains.
- `data/real/items.jsonl` — built by `scripts/build-email-items.ts`, which joins
  looked-up headers to the baseline's labels by Message-ID and drops
  ambiguous threads and rows the baseline never really judged.
  See the [protocol](../../protocols/01-email-triage.md).
- `raw/` — per-item responses, gitignored.

Results go in `RESULTS.md`: aggregates only, example rows from fixtures only.
