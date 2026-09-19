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
| `lib/` | Shared client, runner and scoring (agreement, confusion, confidence gating, latency, tokens) |
| `protocols/` | How each experiment was run, in enough detail to repeat it |
| `scripts/` | Data preparation for specific experiments |
| `.claude/skills/typesafe-ai/` | TypeSafe's agent skill, a pinned and audited copy. See its `AUDIT.md` |

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
node --env-file=.env experiments/01-email-triage/run.ts
```

`@typesafe-ai/sdk` is pinned to an exact, audited version. Bump it
deliberately, never with a range.
