# 05: How does Jev compare with a scanner's LLM?

Run September 18, 2026 · Claude Opus 4.8 with GlutenOrNot's production prompt
at commit `0c07b4d` · Jev `jev-1.13.0` with experiment 03's Noul-per-source rule

**I found no listed-gluten misses from either model on the clean-label
sample.** Jev's median response was 17× faster, at an estimated 240× lower
cost. Most verdict disagreements came from a difference in instructions:
the LLM was told to be cautious about unspecified ingredients; Jev was not.

That makes this a comparison of two implementations, not a general ranking of
the models. Tables come from `compare.ts`.

> **Not medical advice.** References are imperfect and the damaged-label tests
> are synthetic. A `safe` output is not a determination that a food is safe.

## Results at a glance

The clean set contains 996 labels. The `safe` and withheld-verdict percentages
below use a narrower subset: **460 labels with no gluten keyword and a `safe`
database tag**, not independently verified gluten-free foods.

| Measure | Claude Opus 4.8, production prompt | Jev |
| --- | --- | --- |
| Listed-gluten misses found after review | 0 | 0 |
| Calls `safe` on the 460-label subset | 56% | 94% |
| Calls `caution` or `uncertain` on that subset | 43% | 4% |
| Latency, median / 95th percentile | 2.89 s / 5.35 s | 0.17 s / 0.27 s |
| Cost per 1,000 labels | $8.45 | ~$0.035 |

The remaining verdicts in the subset were `unsafe`. More `safe` answers are
not automatically better; they reflect both detection and the chosen policy.

## Checking the apparent misses

The keyword list matched 455 of the 996 labels. Across both models, there were
11 `safe` calls on 9 of those labels. Review found:

- Seven labels explicitly named gluten-free oats, in four languages.
- One named a gluten-free flour blend that could include oats. The LLM said
  `safe`; Jev said `unsafe`.
- One named corn and rice semolina.

None was a listed gluten ingredient that either model had failed to detect.
This sample found no difference on that measure; it cannot establish that the
models have equal miss rates on new labels.

## Where the verdicts differed

| LLM ↓ / Jev → | unsafe | caution | uncertain | safe |
| --- | --- | --- | --- | --- |
| unsafe | 423 | 1 | 0 | 0 |
| caution | 34 | 41 | 15 | 210 |
| safe | 2 | 0 | 3 | 267 |

The largest disagreement was **LLM `caution`, Jev `safe`: 210 labels**.

On the 460-label subset, 199 LLM replies were `caution`. A recurring reason
was an unspecified natural flavor, aroma, or spice that "could hide gluten."
Other reasons included unspecified starch, maltodextrin, and glucose syrup.

The prompt asks for those cautions; Jev's questions did not. That leaves two
questions: can Jev apply the same policy, and is the policy useful? The first
is testable here. The second needs domain review and user research. This
experiment did not measure whether frequent cautions help users.

## Both models struggled with missing text

This set contains two variants of the same 300 gluten-containing labels.
Every original lists gluten; the cut can remove it.

| Damage | Labels | LLM `safe` | LLM reply mentions truncation | Jev `safe`, no gate | Jev `safe`, with completeness gate |
| --- | --- | --- | --- | --- | --- |
| Last half missing | 300 | 13 | 9% | 27 | 6 |
| First half missing | 300 | 26 | 28% | 117 | 56 |

The LLM called **39 truncated labels `safe`**. All came from the 199 variants
where the cut removed the gluten keyword. On the other 401, it returned
`unsafe` 389 times and `caution` 12 times, with no `safe` calls.

Its lower `safe` count does not mean it reliably detected truncation. It called
153 of the 199 keyword-removed variants `caution`, often for reasons unrelated
to the cut. The truncation column measures mentions in its reply, not a
dedicated completeness judgment.

The practical lesson is the same for either model: **a text-only verdict cannot
establish that the whole label was captured.** An ingredients heading may help
check the start, but it is not proof of completeness. Image-level checks and
recapture need testing.

## What I'd try next

- Jev for ingredient judgments, an LLM for explanations and unresolved cases.
  This is a candidate design, not a validated scanner.
- Capture-completeness checks before either model returns `safe`.
- An explicit vague-ingredient policy, tested in
  [experiment 06](../06-vague-ingredients/RESULTS.md).

## Limits and cost

- One reported comparison per model, with no repeatability test on this task.
  Email results from experiment 02 do not establish label-reading variability.
- The LLM ran at concurrency 4 with prompt caching; Jev ran at concurrency 8.
  Latency is observed request time under those conditions, not a controlled
  model-speed benchmark.
- LLM cost uses recorded token usage and the rates in `compare.ts`. Jev cost
  uses TypeSafe's cookbook rate, not an official price sheet. The LLM also
  generates explanations; Jev returns structured scores.
- References were database tags and keywords, with AI-assisted review of
  disagreements—not expert adjudication. There was no independent validation
  set.
- Restaurant menus and image understanding were not tested.

LLM spend: **$8.41 for the clean set and $4.83 for the truncated set.**
