# 01-email-triage

**Question:** given only sender name, sender address and subject line, how often
does Jev agree with an LLM classifier that reads the email body too, and what
does it cost in latency and tokens?

**Items:** one email each. Real items are two weeks of inbox headers joined by
message ID to the class an existing LLM email classifier (prompt-and-parse)
had already assigned. `expected` is that class, so this measures *agreement with
the existing classifier*, not ground truth. Disagreements need a human look
before calling either side wrong.

**Classes:** `needs-attention`, `routine`, `uncertain`. A small share of mail
is labelled by a rule before the model runs; it carries no model judgment and
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
  Grow toward ~100 in the shape of a real inbox mix before filming.
- `data/real/items.jsonl` — built by `scripts/build-email-items.ts`, which joins
  looked-up headers to the baseline's labels by Message-ID and drops
  ambiguous threads and rows the baseline never really judged. See `protocols/01-email-triage.md`.
- `raw/` — per-item responses, gitignored.

Results go in `RESULTS.md`: aggregates only, example rows from fixtures only.
