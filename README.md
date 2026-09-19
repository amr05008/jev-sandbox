# jev-sandbox

A test bench for one question: **where does a System One model beat
prompt-and-parse?**

[Jev](https://docs.typesafe.ai/introduction) is TypeSafe's decision model. You
send it state and typed questions (Choice, Score, Noul) and get back typed
answers with probabilities, no text to parse. This repo runs small, repeatable
experiments against it and records what happened.

## What's here

| path | what it is |
| --- | --- |
| `experiments/` | One folder per experiment: questions, fixtures, results. Start at [`experiments/README.md`](experiments/README.md) |
| `lib/` | Shared client, runner and scoring: agreement, confusion, confidence gating, ranking AUC, latency, tokens, and a table for the one error that is expensive, with confidence bounds. One call can be read several ways ("heads") |
| `protocols/` | How each experiment was run, in enough detail to repeat it |
| `scripts/` | Data preparation for specific experiments |
| `.claude/skills/typesafe-ai/` | TypeSafe's agent skill, a pinned and audited copy. See its `AUDIT.md` |

## What the experiments have found so far

Six experiments, two domains (email triage, gluten on ingredient labels). Each
has its own `RESULTS.md`; the index is [`experiments/README.md`](experiments/README.md).

- **It works as a router before it works as a classifier.** On real email, Jev
  settled 72% of mail alone with full agreement, and sent the rest onward.
- **On a narrow judgment it matched a frontier LLM.** Reading ingredient lists
  in six languages, Jev and Claude Opus 4.8 both missed no listed gluten. Jev
  was 17× faster (0.17 s against 2.9 s) and about 240× cheaper.
- **Where they differed, it was policy, not ability,** and the policy could be
  moved into questions plus a line of code, which then applies it evenly.
- **Noise does not hurt it; missing text does.** Neither model can call a label
  safe from text that was cut off before the gluten. That check belongs in code.
- **Splitting a question helps only when it hides several judgments,** not
  several examples of one. It was decisive once and irrelevant three times.
- **Audit the reference first.** Twice the labels being scored against were
  wrong more often than the model.

> The gluten experiments are **not medical advice** and are not validated for
> deciding what a person with celiac disease can eat.

## Data rules

The script is the artifact; private data is not. Private data lives under
`data/real/` and `raw/`, both gitignored, and its `RESULTS.md` carries
aggregate numbers only. Fixtures are synthetic and committed. Datasets built
from openly licensed sources live under `data/public/` with a licence note and
are committed. Runs default to fixtures; `--real` and `--public` are explicit.

## Setup

Node 24+ (runs TypeScript directly, no build step).

```sh
npm ci --ignore-scripts
cp .env.example .env    # add a key from https://console.typesafe.ai/keys
npm test
node --env-file=.env experiments/01-email-triage/run.ts             # synthetic fixtures
node --env-file=.env experiments/03-gluten-labels/run.ts --public    # 3,300 public labels, ~$0.12
```

Experiment 05 also needs `ANTHROPIC_API_KEY` (use a dedicated, spend-capped
key) and a local checkout of the scanner it compares against.

`@typesafe-ai/sdk` is pinned to an exact, audited version. Bump it
deliberately, never with a range.
