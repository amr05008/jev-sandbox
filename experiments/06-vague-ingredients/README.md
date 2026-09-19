# 06: Vague ingredients

[Results →](RESULTS.md)

> **Not medical advice.** See [experiment 03](../03-gluten-labels/README.md).

**Question:** experiment 05 found that the LLM's vague-ingredient policy
explained most verdict disagreements. Can Jev reproduce that policy? This
tests agreement, not whether the policy is appropriate.

**Items:** experiment 05's 996 labels, paired by ID with its saved LLM replies.
No new LLM calls.

**Rule:** experiment 03's rule, plus: a would-be `safe` becomes `caution` when
a vague-ingredient question fires and no gluten-free claim covers it. Two
shapes are compared: four narrow questions (flavoring, spice, starch, other)
and one compound question.

## Run

```sh
node experiments/06-vague-ingredients/build.ts
node --env-file=.env experiments/06-vague-ingredients/run.ts --public --concurrency=8   # ~$0.04
node experiments/06-vague-ingredients/compare.ts   # needs experiment 05's raw LLM replies
```
