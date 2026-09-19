# Experiments

Each folder is one question put to Jev, with its own questions file, data and
results. Shared plumbing (client, runner, scoring) is in `../lib/`.

| # | question | status | results |
| --- | --- | --- | --- |
| [01-email-triage](01-email-triage/) | Can Jev match an LLM email classifier from headers alone? | run 2026-09-18 | [As a router, yes: 72% settled alone at 100% agreement. As a classifier, no: 43% recall.](01-email-triage/RESULTS.md) |
| [02-reasons-to-care](02-reasons-to-care/) | Does one Noul per reason to care, plus a few lines of personal context, beat a single Choice? | run 2026-09-18 | [Yes: confident misses 2 → 0, 94% of mail decided outright, 97 of 97 routine calls agreed.](02-reasons-to-care/RESULTS.md) |
| [03-gluten-labels](03-gluten-labels/) | Reading ingredient lists in six languages, how often does Jev call an unsafe product safe? | run 2026-09-18 | [0 misses on 1,471 labels that visibly list gluten (≤0.2% at 95%). The database's own tags were wrong far more often than the model.](03-gluten-labels/RESULTS.md) |
| [04-ocr-noise](04-ocr-noise/) | When the label text is damaged the way phone photos damage it, is gluten still caught, and can the model tell when it cannot judge? | run 2026-09-18 | [Noise: no effect (99% flagged at 20% corruption). Truncation: the real risk, and half of missing starts are invisible in the text.](04-ocr-noise/RESULTS.md) |

## Add an experiment

1. `cp -r experiments/_template experiments/NN-name`
2. Write the questions and thresholds in `questions.ts`. Keep them all there.
3. Put synthetic items in `data/fixtures/items.jsonl`. Real items, if any, go in
   `data/real/items.jsonl` and never leave the machine.
4. Run on fixtures first. `--real` is always explicit.
5. Write `RESULTS.md` with aggregates only, then add a row above.
