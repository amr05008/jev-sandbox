# Experiments

I ran these in order: start with a task, inspect the misses, then test what
might explain them. Each folder has a README for the setup and a `RESULTS.md`
for what happened. Shared client, runner, and scoring code lives in `../lib/`.

All results below are from September 18, 2026. These are exploratory tests,
not production validations. Email scores measure agreement with an existing
classifier; food-label scores use imperfect database tags and keyword checks.

| Experiment | Question | Main finding |
| --- | --- | --- |
| [01: Email triage](01-email-triage/) | Can Jev triage email from headers alone? | [At a high confidence threshold, it answered on 72% of the sample with 100% agreement. On its own, it flagged only 10 of 23 emails needing attention.](01-email-triage/RESULTS.md) |
| [02: Reasons to care](02-reasons-to-care/) | Do narrower questions and recipient context help? | [Yes on this sample: no needs-attention emails called routine, and 121 of 129 emails decided outright.](02-reasons-to-care/RESULTS.md) |
| [03: Gluten labels](03-gluten-labels/) | Does Jev miss listed gluten across six languages? | [No misses found on 1,471 reference-positive labels after reviewing keyword errors. The database tags needed an audit first.](03-gluten-labels/RESULTS.md) |
| [04: OCR noise](04-ocr-noise/) | What happens when label text is garbled or cut off? | [Character noise had little effect. Missing text did: the completeness check still let 65 gluten-containing label variants through as safe.](04-ocr-noise/RESULTS.md) |
| [05: LLM comparison](05-llm-side-by-side/) | How does Jev compare with a scanner's production Claude request? | [No listed-gluten misses found for either model. Jev was 17× faster at an estimated 240× lower cost. Both missed gluten removed by truncation.](05-llm-side-by-side/RESULTS.md) |
| [06: Vague ingredients](06-vague-ingredients/) | Can Jev reproduce the LLM's caution policy? | [Agreement rose from 76% to 90%. Applying a policy and choosing a useful policy are different problems.](06-vague-ingredients/RESULTS.md) |

> **Not medical advice.** `safe` is a model output label, not a determination
> that a food is safe to eat.

## Add an experiment

1. `cp -r experiments/_template experiments/NN-name`
2. Put the questions and thresholds in `questions.ts`.
3. Add synthetic fixtures in `data/fixtures/items.jsonl`. Private inputs belong
   in gitignored `data/real/`; openly licensed data belongs in `data/public/`
   with a license note.
4. Run fixtures first. Use `--real` or `--public` explicitly for those datasets.
5. Write `RESULTS.md`, keeping private-data results aggregate-only. Add a row
   above.
