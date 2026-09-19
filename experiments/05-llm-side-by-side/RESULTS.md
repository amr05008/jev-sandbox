# 05-llm-side-by-side — results

Run 2026-09-18. LLM: Claude Opus 4.8 with GlutenOrNot's production prompt at
commit `0c07b4d`. Jev: `jev-1.13.0`, the Noul-per-source rule from experiment
03. Tables are from `compare.ts`.

> **Not medical advice.** One run, imperfect references, synthetic damage.

## Headline

| | Claude Opus 4.8, production prompt | Jev |
| --- | --- | --- |
| Listed gluten that was missed | 0 | 0 |
| Commits to `safe` on labels with no gluten | 56% | 94% |
| Will not commit on those labels | 43% | 4% |
| Latency, median / 95th percentile | 2.89 s / 5.35 s | 0.17 s / 0.27 s |
| Cost per 1,000 labels | $8.45 | $0.035 |

**On catching gluten they tie. Jev is 17× faster and about 240× cheaper. The
real difference is policy, not ability.**

## Catching gluten: a tie

455 of the 996 labels visibly list a gluten word. Across both models there
were 11 `safe` calls on them, over 9 labels. All 9 were read: seven are oats
explicitly marked gluten-free (in four languages), one is a gluten-free flour
blend that may include oats (the LLM said safe, Jev unsafe), and one is corn
and rice semolina. None is listed gluten that either model failed to see. That is the
tie the sample-size note in the README predicted.

## Verdicts, side by side

| LLM ↓ / Jev → | unsafe | caution | uncertain | safe |
| --- | --- | --- | --- | --- |
| unsafe | 423 | 1 | 0 | 0 |
| caution | 34 | 41 | 15 | 210 |
| safe | 2 | 0 | 3 | 267 |

Almost every disagreement is one cell: **the LLM says `caution`, Jev says
`safe` (210).**

## The difference is policy

On 460 labels with no gluten word and a safe database tag, the LLM commits to
`safe` 56% of the time and says `caution` 43% of the time. Its stated reason,
in 155 of 204 such replies: an unspecified **natural flavour, aroma or spice**
that "could hide gluten". Starch with no source named (12) and
maltodextrin or glucose syrup (7) account for most of the rest.

That is the production prompt doing what it was written to do, not a model
failing. Whether it is the right call is a product decision:

- EU law requires cereals containing gluten to be declared and emphasised,
  whatever ingredient they hide in. US law requires wheat to be declared but
  not barley, so malt in a flavouring is a real US gap.
- A scanner that says `caution` on four clean labels in ten trains its users to
  ignore `caution`.

Jev was never asked about vague ingredients, so it cannot be scored on this. If
the policy is wanted, it is one more Noul ("does the list include a flavouring,
spice blend or starch whose source is not named?"), and testing whether that
reproduces the LLM's cautions is the obvious next experiment.

## Truncated labels: the blind spot is shared

All 600 contain gluten; `safe` is the dangerous answer.

| damage | labels | LLM `safe` | LLM reply mentions the text looks cut off | Jev `safe`, no gate | Jev `safe`, with completeness gate |
| --- | --- | --- | --- | --- | --- |
| last half missing | 300 | 13 | 9% | 27 | 6 |
| first half missing | 300 | 26 | 28% | 117 | 56 |

- The LLM is fooled too: 39 truncated gluten labels called `safe`. It shows the
  same pattern as Jev, with **zero reading misses**. Where the gluten word
  survived the cut (401 labels) it said unsafe 389 times, caution 12, safe 0.
  All 39 came from the 199 where the cut removed the ingredient.
- It does better than Jev on missing starts mostly by accident: its broad
  caution habit catches damaged text for unrelated reasons (153 of those 199
  became `caution`). It rarely notices the damage itself.
- So the fix from experiment 04 belongs in the scanner regardless of which
  model reads the text: before anything says `safe`, check in code that the OCR
  output contains an ingredients heading.

## What this suggests for a scanner

1. Jev for the verdict, in about 0.2 s. The LLM for the explanation, for menus,
   and for whatever Jev will not commit on.
2. A heading check and a completeness gate in front of every `safe`.
3. Decide the vague-ingredient policy on purpose. Today it produces most of
   what users see as `caution`.

## What this does not show

- One run of each model. Experiment 02 measured Jev's run-to-run noise at a
  few labels in a hundred near a threshold; the LLM's was not measured.
- LLM latency was measured from one machine at concurrency 4 with a warm prompt
  cache. A cold cache adds a slower first call.
- Jev's price is the figure quoted in TypeSafe's cookbooks, not a price sheet.
- The references are the database tags and a keyword list, checked by reading
  the disagreements with an AI assistant, not by a dietitian.
- Restaurant menus, which the scanner also handles and Jev cannot, were not
  tested.

## Spend

$8.41 for the clean set, $4.83 for the truncated set.
