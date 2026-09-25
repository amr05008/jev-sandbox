# 07: Barcode bake-off: Opus 4.8 vs Haiku 4.5 vs Jev + rules

**Question:** can a faster engine give the same barcode verdicts as a
scanner's production Claude Opus 4.8 request, with zero false-safe, and how
much faster is it?

**Engines, same inputs:**
- **opus:** the scanner's production barcode request, byte for byte (raw
  fetch, its prompt and cache marker, `max_tokens` 2048, no thinking).
- **haiku:** the same request with only the model id changed. That measures
  the model, not a prompt rewrite.
- **jev + rules (E2):** the scanner's own tag checks run first. Jev then
  answers nine yes/no questions about the ingredient text only
  (`questions.ts`), and a rule in code (`engines.ts`, `e2Rule`) settles only a
  clear `unsafe` or `safe`. Everything else falls through to Claude.

**Items:**
- **D1:** the scanner's 30 frozen, synthetic barcode eval cases, each with an
  expected verdict. The Claude engines sample 2× for cases expected safe and
  5× for the rest; Jev samples 2×.
- **D2:** experiment 05's 996 Open Food Facts products, re-fetched by barcode
  through the scanner's own lookup so they carry allergen, trace and label
  tags (`fetch-records.ts`, public ODbL data). There is no ground truth. The
  hard reference is that no label visibly listing gluten may come back
  `safe`; every other disagreement with Opus gets reviewed.

The scanner's plan: `plans/barcode-bakeoff-2026-09-24.md` in
amr05008/glutenornot.com.

## Run

```sh
S=/path/to/glutenornot-checkout   # needs the commit that exports GLUTEN_GRAIN_PATTERN
node experiments/07-barcode-bakeoff/fetch-records.ts --scanner=$S                    # D2, ~45 min, no keys
node --env-file=.env experiments/07-barcode-bakeoff/run.ts --scanner=$S --set=d1     # dry: plan + estimate, spends nothing
node --env-file=.env experiments/07-barcode-bakeoff/run.ts --scanner=$S --set=d1 --confirm
node --env-file=.env experiments/07-barcode-bakeoff/run.ts --scanner=$S --set=d2 --confirm
node experiments/07-barcode-bakeoff/compare.ts --set=d1
node experiments/07-barcode-bakeoff/compare.ts --set=d2
```

`.env` needs `TYPESAFE_API_KEY` and `ANTHROPIC_API_KEY`. Use a dedicated,
spend-capped Anthropic key. The runner:
- refuses to spend without `--confirm`;
- caps a run at 2,500 Claude calls;
- refuses a scanner checkout with uncommitted changes;
- resumes from `raw/` instead of re-spending.

## Data

- `data/public/records.jsonl`: the re-fetched Open Food Facts records, with
  `LICENSE.md` beside them.
- `raw/`: per-call responses and the review lists (gitignored).

Results go in `RESULTS.md`: aggregate numbers only.
