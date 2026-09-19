# 06-vague-ingredients — results

Run 2026-09-18, model `jev-1.13.0`. 996 labels paired with experiment 05's
Claude Opus 4.8 replies (GlutenOrNot's production prompt, commit `0c07b4d`).

> **Not medical advice.**

## Headline

**Yes. One policy, written as questions plus a line of code, takes Jev from
76% to 90% agreement with the LLM's verdicts**, and from sharing 31% of its
cautions to sharing 96%. It still answers in 170 ms.

| Jev rule | same verdict as the LLM | of the LLM's `caution`s, Jev also withholds `safe` | LLM `safe`, Jev not | Jev `safe`, LLM not |
| --- | --- | --- | --- | --- |
| experiment 03's rule | 75.7% | 31.3% | 6 | 206 |
| + four vague-ingredient questions | 90.0% | 95.7% | 57 | 13 |
| + one compound question | 90.0% | 94.3% | 53 | 17 |

| LLM ↓ / Jev with policy → | unsafe | caution | safe |
| --- | --- | --- | --- |
| unsafe | 424 | 0 | 0 |
| caution | 30 | 257 | 13 |
| safe | 2 | 55 | 215 |

(Jev's `uncertain` is counted with `caution`, since the LLM has no such label.)

## Where they still differ

**The LLM applies its own policy unevenly; the code rule does not.** In 51 of
the 55 labels the LLM called `safe` and Jev called `caution`, a
vague-ingredient question fired at high confidence on exactly the ingredients
the LLM flags elsewhere: `aroma`, `aromas`, `sirop de glucose`, `Curry`. Same
ingredient, different verdict, depending on the label. A rule in code gives the
same answer every time, which is the property a user learns to trust.

**The 13 the other way** are mostly a distinction Jev was not asked to make:
the LLM treats "gluten-free oat flour" as an ingredient-level claim that does
not cover the rest of the product, while Jev's single gluten-free-claim
question reads it as a claim. A narrower question would separate the two.

## How often the policy fires

| flavouring | spice | starch | other | compound | gluten-free claim |
| --- | --- | --- | --- | --- | --- |
| 52% | 23% | 30% | 8% | 64% | 4% |

An unnamed flavouring appears on **half of all labels**. That is the real size
of this policy: adopted as written, it withholds `safe` from most packaged
food. Worth knowing before choosing it.

## Split or compound?

No difference (90.0% both). This is the third experiment running where splitting
a question did not help, against one (experiment 02) where it was the whole
win. The pattern: splitting helps when the original question hides several
*different judgments* ("does this email matter?"), not when it lists several
*examples of one judgment* ("is any ingredient's source unnamed?"). The split
version still earns its keep by saying which ingredient triggered the caution.

## What this does not show

- Agreement with the LLM is not correctness. Nothing here says the policy is
  right, only that Jev can carry it.
- Thresholds (0.5 and 0.5) were fixed before the run and not tuned.
- One run; experiment 02 put run-to-run noise at a few labels in a hundred near
  a threshold.
