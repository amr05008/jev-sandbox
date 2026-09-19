# 04: OCR noise

[Results →](RESULTS.md)

> **Not medical advice.** See [experiment 03](../03-gluten-labels/README.md).

**Question:** can Jev still detect gluten when ingredient text is garbled or
cut off? Can it tell when too much is missing to judge? This simulates errors
from OCR (text extracted from a photo); it does not test real photos.

**Items:** 600 labels from experiment 03 where the database and keyword
check agree (300 list gluten, 300 do not; 50 + 50 per language), each under
10 conditions: a clean control, 5/10/20% character noise, narrow-label line
breaks, a nutrition table mixed in, the last 30% or 50% cut off, the first 50%
cut off, and a cut plus noise. 6,000 items, seeded, committed (`data/public/`).

**Rule:** the same source questions and thresholds as experiment 03, plus a
gate: `safe` is only allowed on text that looks complete. A damaged list can
still show a gluten source; finding none does not establish that the full list
has none. I compare one compound completeness question with three separate
questions.

## Run

```sh
node scripts/build-ocr-noise.ts                                                 # rebuild the dataset
node --env-file=.env experiments/04-ocr-noise/run.ts --public --concurrency=8   # ~$0.25
node experiments/04-ocr-noise/analyze.ts [--gate=gated3]                        # per-damage tables
```
