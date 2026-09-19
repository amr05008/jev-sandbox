# 06: Can Jev reproduce the LLM's caution policy?

Run September 18, 2026 · Jev `jev-1.13.0` · 996 labels paired with experiment
05's Claude Opus 4.8 replies (GlutenOrNot prompt, commit `0c07b4d`)

**Adding the policy raised verdict agreement from 76% to 90%.** Jev also
withheld `safe` on 96% of the LLM's `caution` cases, up from 31%. Median latency
remained about 170 ms.

This tests whether Jev can reproduce a policy, not whether the policy is right.

> **Not medical advice.** Agreement between models does not establish whether
> a food is safe to eat.

## What I added

I added questions about unspecified flavorings, spices, starches, and other
ingredients to experiment 03's rule. A would-be `safe` becomes `caution` if any
score is ≥ 0.5 and the gluten-free-claim score is < 0.5. I tested four separate
questions against one compound question.

| Jev rule | Same verdict as LLM | LLM `caution` cases where Jev withholds `safe` | LLM `safe`, Jev not | Jev `safe`, LLM not |
| --- | --- | --- | --- | --- |
| Experiment 03's rule, rerun here | 75.7% | 31.3% | 6 | 206 |
| + Four vague-ingredient questions | 90.0% | 95.7% | 57 | 13 |
| + One compound question | 90.0% | 94.3% | 53 | 17 |

For agreement, Jev's `uncertain` is grouped with `caution`, since the LLM has
no `uncertain` label. With the four-question policy:

| LLM ↓ / Jev → | unsafe | caution | safe |
| --- | --- | --- | --- |
| unsafe | 424 | 0 | 0 |
| caution | 30 | 257 | 13 |
| safe | 2 | 55 | 215 |

## Where they still differed

Of 55 labels the LLM called `safe` and Jev called `caution`, 51 triggered a
vague-ingredient question at high confidence. Ingredients included `aroma`,
`sirop de glucose`, and `Curry`, which the LLM flagged elsewhere. That suggests
uneven policy application, though surrounding text can matter.

Putting the policy in code makes the **mapping from scores to verdicts**
consistent and inspectable. It does not make the model's ingredient judgments
deterministic or necessarily correct.

The 13 disagreements in the other direction mostly concerned the scope of a
gluten-free claim. The LLM treated "gluten-free oat flour" as a claim about one
ingredient, not the whole product. Jev's broad claim question did not reliably
make that distinction. A narrower question is the next thing to test.

## How broad is this policy?

Share of the 996 labels scoring ≥ 0.5 on each question:

| Flavoring | Spice | Starch | Other | Compound question | Gluten-free claim |
| --- | --- | --- | --- | --- | --- |
| 52% | 23% | 30% | 8% | 64% | 4% |

Flavoring alone triggered on half this sample. The categories overlap and
only affect otherwise-`safe` verdicts without a gluten-free claim. This is a
broad policy, but not evidence that half of all packaged food needs a caution.

## Did splitting the question help?

Both versions reached 90.0% agreement. Splitting also made little difference
in experiments 03 and 04, unlike [email triage](../02-reasons-to-care/RESULTS.md).
My hypothesis: splitting helps more when a question hides *different
judgments* than when it lists *examples of one judgment*. Separate questions
still help explain what triggered a caution.

## Limits and next steps

- The policy was chosen after inspecting experiment 05 and tested on the same
  labels, not a held-out sample.
- New thresholds were fixed before this run, with no later tuning.
- One run; repeatability was not measured.

Next: distinguish ingredient-level from product-level gluten-free claims, then
test the revised questions on new labels. Separately, review whether this
caution policy belongs in the product at all.
