# 04-ocr-noise

> **Not medical advice.** See experiment 03.

**Question:** experiment 03 used clean, typed ingredient lists. A scanner gets
text from a phone photo. When that text is damaged, does Jev still catch the
gluten, and can it tell when a list is too damaged to call safe?

**Items:** 600 labels from experiment 03 where the database and the keyword
witness agree (300 list gluten, 300 do not; 50 + 50 per language), each under
10 kinds of damage: clean, 5/10/20% character noise, narrow-label line breaks,
a nutrition table bleeding in, the last 30% or 50% cut off, the first 50% cut
off, and a cut plus noise. 6,000 items, seeded, committed (`data/public/`).

**Rule:** the same source questions and thresholds as experiment 03, plus a
gate: `safe` is only allowed on text that looks complete. Finding gluten in a
damaged list can be trusted; failing to find it cannot. Two gates are compared:
one compound completeness question, and the same check split in three.

## Run

```sh
node scripts/build-ocr-noise.ts                                                 # rebuild the dataset
node --env-file=.env experiments/04-ocr-noise/run.ts --public --concurrency=8   # ~$0.25
node experiments/04-ocr-noise/analyze.ts [--gate=gated3]                        # per-damage tables
```
