# 06-vague-ingredients

> **Not medical advice.** See experiment 03.

**Question:** experiment 05 found that the production LLM and Jev tie on
catching gluten and differ on policy: the LLM says `caution` on 43% of clean
labels, mostly because an unspecified flavouring "could hide gluten". Can Jev
carry that policy if asked, and how closely does it then match the LLM?

**Items:** the same 996 labels experiment 05 sent to the LLM, paired by id. No
new LLM spend: its replies are already on disk.

**Rule:** experiment 03's rule, plus: a would-be `safe` becomes `caution` when
a vague-ingredient question fires and no gluten-free claim covers it. Two
shapes are compared: four narrow questions (flavouring, spice, starch, other)
and one compound question.

## Run

```sh
node experiments/06-vague-ingredients/build.ts
node --env-file=.env experiments/06-vague-ingredients/run.ts --public --concurrency=8   # ~$0.04
node experiments/06-vague-ingredients/compare.ts   # needs experiment 05's raw LLM replies
```
