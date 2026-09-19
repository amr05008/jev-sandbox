# 05: Jev and an LLM, side by side

[Results →](RESULTS.md)

> **Not medical advice.** See [experiment 03](../03-gluten-labels/README.md).

**Question:** on the same labels, how does Jev compare with a scanner's
production LLM request for gluten detection, verdicts, speed, and cost?

**The LLM side** is [GlutenOrNot](https://github.com/amr05008/glutenornot.com)'s
production request: its prompt constant, Claude Opus 4.8,
`max_tokens` 4096, the prompt cached, the label passed as `### OCR Text:`. The
prompt is imported from a local checkout at run time (pinned here at commit
`0c07b4d`), not copied into this repo, and replies are parsed with the
scanner's own `parseClaudeResponse`.

**Items, paired with Jev's existing runs:**

- `clean`: 996 of experiment 03's 3,300 labels, a seeded sample keeping its
  language × class proportions (`data/public/sample-clean.json`).
- `cuts`: experiment 04's 300 gluten labels with the last half cut off, and the
  same 300 with the first half cut off (`data/public/sample-cuts.json`).

**Why about 1,000 labels:** enough for a first comparison of latency, cost,
and common verdict differences. Neither 1,000 nor 3,300 can reliably distinguish
very low miss rates. A safety validation would need a larger, independently
reviewed dataset.

## Run

```sh
node --env-file=.env experiments/05-llm-side-by-side/run.ts --scanner=/path/to/glutenornot.com --set=clean   # ~$8.50
node --env-file=.env experiments/05-llm-side-by-side/run.ts --scanner=/path/to/glutenornot.com --set=cuts    # ~$5
node experiments/05-llm-side-by-side/compare.ts
```

Needs `ANTHROPIC_API_KEY` in `.env` and experiments 03 and 04 already run with
`--public`. Results are checkpointed to `raw/`; re-running resumes and does not
re-spend.
