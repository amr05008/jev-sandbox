# 05-llm-side-by-side

> **Not medical advice.** See experiment 03.

**Question:** how does Jev compare, on the same labels, with the LLM a real
label scanner uses in production: on catching gluten, on how often it commits
to an answer, on speed, and on cost?

**The LLM side** is [GlutenOrNot](https://github.com/amr05008/glutenornot.com)'s
production request, reproduced exactly: its prompt constant, Claude Opus 4.8,
`max_tokens` 4096, the prompt cached, the label passed as `### OCR Text:`. The
prompt is imported from a local checkout at run time (pinned here at commit
`0c07b4d`), not copied into this repo, and replies are parsed with the
scanner's own `parseClaudeResponse`.

**Items, paired with Jev's existing runs:**

- `clean`: 996 of experiment 03's 3,300 labels, a seeded sample keeping its
  language × class proportions (`data/public/sample-clean.json`).
- `cuts`: experiment 04's 300 gluten labels with the last half cut off, and the
  same 300 with the first half cut off (`data/public/sample-cuts.json`).

**Why 1,000 and not 3,300.** Speed and cost settle in a hundred calls. Rates
settle to ±2–3 points at a thousand. The rare costly error does not settle at
either size: if both models miss about nothing, telling 0.1% from 0.3% takes
tens of thousands of labels. The extra 2,300 calls would have bought a tighter
bound on a tie.

## Run

```sh
node --env-file=.env experiments/05-llm-side-by-side/run.ts --scanner=/path/to/glutenornot.com --set=clean   # ~$8.50
node --env-file=.env experiments/05-llm-side-by-side/run.ts --scanner=/path/to/glutenornot.com --set=cuts    # ~$5
node experiments/05-llm-side-by-side/compare.ts
```

Needs `ANTHROPIC_API_KEY` in `.env` and experiments 03 and 04 already run with
`--public`. Results are checkpointed to `raw/`; re-running resumes and does not
re-spend.
