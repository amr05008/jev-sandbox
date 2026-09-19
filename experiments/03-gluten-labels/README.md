# 03-gluten-labels

> **Not medical advice.** This measures a model against a crowd-sourced
> database and a keyword list. Nothing here is validated for deciding what a
> person with celiac disease can eat.

**Question:** reading only a product's ingredient list, in six languages, how
often does Jev call a product safe when it is not? And does one three-way
Choice or one Noul per gluten source do better?

**Why this metric:** the two errors are not equal. Calling a safe product
unsafe costs someone a snack. Calling an unsafe product safe makes them ill.
So the headline is not agreement; it is how often `safe` was given wrongly,
with a confidence bound, because a rare-event claim needs a big sample.

**Items:** 3,300 real ingredient lists from Open Food Facts' bulk export, a
seeded random sample of 550 per language (en, es, fr, nl, de, it): 150 tagged
with gluten as an allergen, 60 with gluten as a trace, 340 with neither (90 of
those carrying a gluten-free label). `expected` comes from OFF's tags. The
data is public, so it is committed (`data/public/`, ODbL).

**Both shapes in one call.** Questions are evaluated in isolation, so the
Choice and the six Nouls are asked together and read three ways ("heads"):
`choice`, `nouls`, and `both` (safe only if the two agree).

## Run

```sh
node --env-file=.env experiments/03-gluten-labels/run.ts             # 60-item subset
node --env-file=.env experiments/03-gluten-labels/run.ts --public    # all 3,300, ~$0.12
node experiments/03-gluten-labels/analyze.ts                         # second opinion on the labels
node scripts/pull-gluten-labels.ts                                   # rebuild the dataset (streams ~1.3 GB)
```

`data/fixtures/` here is a 60-item subset of the public data, not synthetic.
