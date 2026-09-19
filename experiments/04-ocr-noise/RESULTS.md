# 04: What happens when label text is damaged?

Run September 18, 2026 · Jev `jev-1.13.0` · SDK `0.6.0`

**Missing text was the bigger problem, not garbled characters.** After the
completeness check, Jev still called 65 gluten-containing label variants
`safe`. None retained a gluten word readable by the keyword check. The model
was judging what remained, not what the full label had said.

I tested 600 labels under 10 conditions, including a clean control: 6,000
items total. Half the original labels listed gluten; half did not. Tables
come from `analyze.ts`.

> **Not medical advice.** This uses synthetic damage and imperfect references,
> not real camera scans or a clinical safety evaluation.

## Did Jev still flag gluten?

Each row below contains variants of the same 300 gluten-containing labels.
"Gate" means a yes/no completeness question that blocks `safe` when its score
is below 0.5.

| Condition | Keyword still readable | Jev says `unsafe` | `safe` before gate | Blocked by gate | `safe` after gate |
| --- | --- | --- | --- | --- | --- |
| Clean | 100% | 98.7% | 0 | 0 | **0** |
| 5% character noise | 94% | 99.0% | 0 | 0 | **0** |
| 10% character noise | 86% | 99.0% | 1 | 1 | **0** |
| 20% character noise | 68% | 99.3% | 0 | 0 | **0** |
| Line breaks and hyphenation | 95% | 99.0% | 0 | 0 | **0** |
| Nutrition table mixed in | 100% | 98.7% | 0 | 0 | **0** |
| Last 30% cut off | 93% | 94.3% | 16 | 13 | **3** |
| Last 50% cut off | 89% | 90.0% | 27 | 21 | **6** |
| First 50% cut off | 45% | 49.3% | 117 | 61 | **56** |
| Last 50% cut off + 10% noise | 72% | 90.0% | 22 | 22 | **0** |

At 20% character corruption, the keyword list still matched 68% of labels;
Jev flagged 99%. The one `safe` call under character noise occurred at 10%
corruption and was blocked by the completeness gate.

Cutting off the start was much worse. Flour often appears first, and removing
the first half erased the gluten keywords from 55% of labels. The gate caught
61 of 117 `safe` calls, but let 56 through. Finding no gluten in a fragment
does not tell you whether the product contains it.

## What the completeness check cost

The middle column covers all 600 labels per condition. The last covers the
300 labels whose originals had no gluten according to both references.

| Condition | Judged incomplete | Reference-negative labels still called `safe` after gate |
| --- | --- | --- |
| Clean | 12% | 78% (94% before gate) |
| 10% character noise | 95% | 7% |
| Last 50% cut off | 77% | 20% |
| First 50% cut off | 57% | 29% |

The check sent most garbled text to a fallback, but it also reduced `safe`
coverage on clean, reference-negative labels from 94% to 78%. It caught
missing ends more reliably than missing starts.

## Did three questions work better than one?

The first gate asked whether the list started whole, ended whole, and was
legible. After seeing the result, I split those into three questions.
**It let 57 start-cut gluten labels through as `safe`, versus 56 with the
single question. No improvement.**

The percentages below are scores **below** 0.5: the question judged that part
incomplete or illegible.

| Condition | Start judged incomplete | End judged incomplete | Text judged illegible |
| --- | --- | --- | --- |
| Clean | 1% | 9% | 8% |
| 10% character noise | 4% | 18% | 97% |
| Last 50% cut off | 1% | 73% | 54% |
| First 50% cut off | 50% | 19% | 28% |

Separate scores could help explain what to recapture, but they did not make
this check safer. A fragment beginning `15 % Blattspinat, 10 % Kochschinken…`
can look like the start of a list. Jev also missed more obvious clues:
`germilchpulver, Süßmolkenpulver…` starts mid-word but scored 0.94 for having
a complete start.

## What I'd test in a scanner

1. **Keep detecting visible gluten even in damaged text.** An incomplete scan
   can still contain useful evidence; it cannot support an all-clear.
2. **Check capture completeness before allowing `safe`.** An ingredients
   heading and the list's visible boundaries are useful candidates. Neither a
   heading nor a closing full stop proves the full label was captured; these
   checks still need testing on real packages.
3. **Use a fallback that can see the image, or ask for another scan.** Giving
   another text model the same fragment does not restore missing ingredients.

## Limits and next steps

- Synthetic character errors do not reproduce glare, curved packaging, small
  print, or errors clustered in one part of an image.
- The 600 labels were selected because the database and keywords agreed, so
  they are easier than the full dataset. Variants of one label are not
  independent samples.
- Initial thresholds were fixed before the run. The three-part gate was added
  after inspecting the first result.
- Open Food Facts lists lack headings, so this did not test a heading check.

[Experiment 05](../05-llm-side-by-side/RESULTS.md) tests the same truncated
labels with the scanner's LLM. Real photos, capture checks, and a vision
fallback remain untested here.
