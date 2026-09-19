# 04-ocr-noise — results

Run 2026-09-18, model `jev-1.13.0`, SDK `0.6.0`. 600 labels × 10 kinds of
damage. Tables below are from `analyze.ts`.

> **Not medical advice.** One run, synthetic damage, imperfect references.

## Headline

**Jev never failed to read gluten that was still on the page.** Across 3,000
damaged gluten labels, every one that ended as `safe` had lost its gluten
ingredient to the cut; none was a reading miss. Noise is not the danger.
**A missing start is**, and no question asked of the text alone fixes it.

## Labels that contain gluten: is it still caught?

| damage | keyword list can still read a gluten word | Jev flags it | called `safe` | stopped by the completeness gate | **`safe` after the gate** |
| --- | --- | --- | --- | --- | --- |
| clean | 100% | 98.7% | 0 | 0 | **0** |
| 5% character noise | 94% | 99.0% | 0 | 0 | **0** |
| 10% character noise | 86% | 99.0% | 1 | 1 | **0** |
| 20% character noise | 68% | 99.3% | 0 | 0 | **0** |
| line breaks and hyphenation | 95% | 99.0% | 0 | 0 | **0** |
| nutrition table bleeding in | 100% | 98.7% | 0 | 0 | **0** |
| last 30% cut off | 93% | 94.3% | 16 | 13 | **3** |
| last 50% cut off | 89% | 90.0% | 27 | 21 | **6** |
| first 50% cut off | 45% | 49.3% | 117 | 61 | **56** |
| last 50% cut off + 10% noise | 72% | 90.0% | 22 | 22 | **0** |

- **Noise barely registers.** At 20% character corruption a keyword list can
  still find a gluten word in 68% of labels; Jev flags 99%. It reads
  `WEIEENMEHL` and `Sp eíscsalz` the way a person would.
- **Cuts are the whole problem, and the start is worst,** because flour tends
  to be listed first. Lose the first half and the gluten is gone from 55% of
  labels. Reading what is left as "no gluten here" is correct and useless.
- Of the 65 that ended `safe`, the gluten word was readable in **0**.

## The completeness gate

| damage | judged incomplete (one question) | labels without gluten still called `safe` after the gate |
| --- | --- | --- |
| clean | 12% | 78% (was 94%) |
| 10% character noise | 95% | 7% |
| last 50% cut off | 77% | 20% |
| first 50% cut off | 57% | 29% |

The gate is cheap where it matters (a clean label still settles 78% of the
time) and sends most damaged text to the fallback, which is what it is for.
It catches a missing end far better than a missing start.

## Splitting the question did not help

The first gate asked one compound question (starts whole, ends whole, legible).
Experiment 02's lesson says split it, so a second gate asked the three parts
separately. **Result: 57 start-cut labels through instead of 56. No change.**

| damage | `starts_whole` fires | `ends_whole` fires | `legible` fires |
| --- | --- | --- | --- |
| clean | 1% | 9% | 8% |
| 10% character noise | 4% | 18% | 97% |
| last 50% cut off | 1% | 73% | 54% |
| first 50% cut off | 50% | 19% | 28% |

The parts do separate cleanly, which is useful for telling a user *what* to
fix ("move the camera left" versus "hold it steady"). But half of start cuts
are invisible in the text: a list that begins ` 15 % Blattspinat, 10 %
Kochschinken…` is a perfectly good start of a list. It also missed some it
could have caught: `germilchpulver, Süßmolkenpulver…` begins mid-word and
scored 0.94.

## What this means for a scanner

1. **Let the model settle `unsafe` on anything it can read.** Damage does not
   make a found gluten ingredient less real.
2. **Do not let it settle `safe` from text alone.** Gate on completeness, and
   add the check the text cannot give: the OCR output should contain the
   word "Ingredients" (or its translation) and the list's closing full stop.
   Open Food Facts entries have no heading, so this experiment is harsher than
   a real photo, where a missing heading is a strong, free signal.
3. **Everything gated goes to the fallback**, ideally one that can see the
   image and not just the text.

## What this does not show

- Synthetic damage is not a real camera. Real OCR errors cluster (glare, curved
  foil, small print) rather than falling uniformly.
- The 600 labels were chosen because two references agree on them, so they are
  easier than the full set.
- Thresholds were fixed before the first run. The three-part gate was added
  after seeing the first result, and is reported as the null result it was.
- No comparison against an LLM reading the same damaged text.

## Next questions

1. Real photos, real OCR: a few hundred, with the heading check in place.
2. The same damaged labels through the LLM a scanner would otherwise use.
3. A vision fallback: does looking at the image recover the start-cut cases?
