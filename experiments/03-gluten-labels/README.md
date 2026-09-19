# 03: Gluten labels

[Results →](RESULTS.md)

> **Not medical advice.** This measures a model against a crowd-sourced
> database and a keyword list. Nothing here is validated for deciding what a
> person with celiac disease can eat.

**Question:** does Jev miss listed gluten across six languages? Does one
three-way Choice or a separate yes/no score (Noul) per source work better?

**Why this metric:** a false `safe` can have more serious consequences than an
unnecessary warning. I measure it separately from overall agreement, with a
confidence bound. The [results](RESULTS.md) distinguish disagreement with the
database from missed ingredients.

**Items:** 3,300 real ingredient lists from Open Food Facts' bulk export, a
seeded random sample of 550 per language (en, es, fr, nl, de, it): 150 tagged
with gluten as an allergen, 60 with gluten as a trace, 340 with neither (90 of
those carrying a gluten-free label). `expected` comes from OFF's tags. The
data is public, so it is committed (`data/public/`, ODbL).

**Three decision rules from one call:** `choice`, `nouls`, and `both`. The
combined rule requires the Choice to select `safe` and all Noul scores to be
below 0.2; unlike the standalone Choice rule, it does not apply the Choice's
0.6 confidence cutoff.

## Run

```sh
node --env-file=.env experiments/03-gluten-labels/run.ts             # 60-item subset
node --env-file=.env experiments/03-gluten-labels/run.ts --public    # all 3,300, ~$0.12
node experiments/03-gluten-labels/analyze.ts                         # second opinion on the labels
node scripts/pull-gluten-labels.ts                                   # rebuild the dataset (streams ~1.3 GB)
```

`data/fixtures/` here is a 60-item subset of the public data, not synthetic.
