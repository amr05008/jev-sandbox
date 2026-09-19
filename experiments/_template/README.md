# NN-name

**Question:** what is this experiment trying to find out, in one sentence?

**Items:** what one item is, where the real ones come from, how `expected` was
produced (and how much to trust it).

**Compared against:** the baseline (an existing classifier, an LLM prompt, a
human label).

## Run

```sh
node --env-file=.env experiments/NN-name/run.ts          # fixtures
node --env-file=.env experiments/NN-name/run.ts --real   # data/real/, gitignored
```

## Data

- `data/fixtures/items.jsonl` — synthetic, committed, safe to show.
- `data/real/items.jsonl` — real, gitignored, never on screen.
- `data/public/items.jsonl` — only for openly licensed data: committed, with a
  `LICENSE.md` beside it. Run with `--public`.
- `raw/` — per-item API responses, gitignored (they echo the item's state).

One item per line: `{"id": "...", "state": {...}, "expected": "label"}`.

Results go in `RESULTS.md`: aggregate numbers only. Any example rows must come
from fixtures.
