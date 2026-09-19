# 03: Can Jev find gluten across six languages?

Run September 18, 2026 · Jev `jev-1.13.0` · SDK `0.6.0`

**I found no listed-gluten misses on the 1,471 reference-positive labels.**
That is encouraging, but the first result looked much worse: roughly 7–8% of
Jev's `safe` calls disagreed with the database. Auditing those disagreements
changed the story.

The test used 3,300 Open Food Facts ingredient lists: 550 each in English,
Spanish, French, Dutch, German, and Italian. Examples below are public data.

> **Not medical advice.** `safe` is an experimental output label, not a
> determination that a food is safe to eat. The references were checked with
> a keyword list and AI-assisted review, not by a dietitian.

## The first score was misleading

The initial reference labels came from Open Food Facts' allergen and trace
tags. Against those tags:

| Decision rule | Called `safe` | Disagreed with tags | Disagreement rate | Rate at confidence ≥ 0.95 |
| --- | --- | --- | --- | --- |
| One Choice | 1,553 | 114 | 7.3% | 6.8% |
| Noul per source | 1,574 | 125 | 7.9% | 6.8% |
| Combined rule | 1,572 | 124 | 7.9% | 6.6% |

Raising the confidence threshold barely changed the disagreement rate. That
does not prove the reference is wrong—a model can be confidently wrong too—but
it was a reason to inspect the rows rather than tune the threshold.

## What the audit found

`analyze.ts` checks the same text with a multilingual keyword list. I used that
as a second reference and reviewed disagreements with an AI assistant. These
are selected cells for the Noul-per-source rule, not the full dataset:

| Database label | Keyword list | Jev | Count | Review finding |
| --- | --- | --- | --- | --- |
| safe | Finds gluten word | unsafe | 486 | Text lists ingredients such as wheat flour or barley malt; the database lacks the tag. |
| safe | Finds gluten word | safe | 18 | Oats explicitly marked gluten-free; keyword false positives. |
| caution | No match | safe | 113 | The may-contain warning is absent from the input; OFF stores it separately. |
| unsafe | No match | safe | 11 | None lists a gluten ingredient; one says "gluten- und laktosefrei". The tag is unsupported by the supplied text. |
| unsafe | Finds gluten word | unsafe | 861 | Agreement. |
| safe | No match | safe | 1,431 | Agreement. |

Of 2,040 products assigned `safe` from the database tags, **507 (25%) had a
gluten keyword in the text**. Not all were genuine gluten sources: 18 were
explicitly gluten-free oats. Jev called 486 of the 507 `unsafe`.

The 125 Noul `safe` calls that disagreed with the tags broke down into 113
missing warnings, 11 tags unsupported by the text, and one corn-and-rice
semolina keyword error. None was a listed gluten ingredient missed in review.
Only 195 of the 360 products tagged may-contain included that warning in their
ingredient text.

This repeated the lesson from [experiment 01](../01-email-triage/RESULTS.md):
**check the answer key before trusting the score.** Missing tags and missing
input text are different problems from a model failing to read an ingredient.

## Where the model beat the keyword list

The keyword list matched 1,490 labels. Jev called 19 of them `safe`; review
found all 19 were keyword errors, leaving 1,471 reference-positive labels and
no observed misses. Examples:

- `Copos de avena integral sin gluten`, `haver (glutenvrij)`, `Glutenfreie
  Vollkorn-Haferflocken`, and `farine d'avoine sans gluten`: gluten-free oats.
  Jev followed the question's explicit exception for them.
- `sémola de maíz, sémola de arroz`: corn and rice semolina.

Jev also flagged ingredients the keywords missed: `farina tipo "0"`,
`Farina 00`, Dutch `bloem` (flour, without the word wheat), and
`aroma's (bevat GLUTEN)`.

The keyword list needed fixes of its own. Its first two versions missed `blé`
and `Hartweizengrieß` because JavaScript's `\b` and `\w` are ASCII-only.
Multilingual keyword matching was less straightforward than it looked.

## Where Jev was too cautious

Jev withheld `safe` on 255 labels with no gluten keyword: 113 were `caution`,
142 were `unsafe` or `uncertain`. In a reviewed sample of those 142, roughly
half were useful catches or warnings; a quarter were debatable cases such as
gluten-free wheat starch; and a quarter were over-caution or plain errors,
including maltodextrin, maltose syrup, unnamed starch, and a rye flag on spiced
butter. Those proportions describe the reviewed sample, not all 142 labels.

The rule also called 110 of 360 may-contain products `unsafe` rather than
`caution`: "may contain wheat" triggered the wheat question. Asking about
*ingredients*, separately from warnings, is a follow-up worth testing.

## Did splitting the question help?

Not much here. One Choice and one Noul per source produced similar `safe`
counts (1,553 and 1,574); the combined rule changed little. Unlike email
importance, identifying a gluten source is already a narrow judgment.

The split questions still help explain a verdict: they identify which source
triggered it. This result suggests a useful distinction to test, not a general
rule that decomposition never helps ingredient reading.

## Speed, cost, and limits

- Median latency: 170 ms; 95th percentile: 282 ms, with seven questions per
  call and eight concurrent calls.
- About 830 input tokens per label. Estimated cost: **$0.035 per 1,000 labels**,
  or $0.12 for the run, at TypeSafe's cookbook rate of $0.042 per million input
  tokens.
- Zero misses on 1,471 reference-positive labels gives a rough 95% upper bound
  of **0.2%**, conditional on the reference and sampling assumptions. It is not
  a bound on the chance of telling someone an unsafe food is safe.
- A gluten source missed by the keywords, Jev, and database could escape this
  audit. There was no expert review or independent validation set.
- The keyword-visible miss count was zero in all six languages. Disagreement
  with database tags ranged from 3% to 10%; that alone cannot rank language
  performance.
- These were typed ingredient lists, not photos. Warnings elsewhere on a
  package were often absent. Thresholds were fixed in advance but not validated
  on a fresh sample.

## What I tried next

[Experiment 04](../04-ocr-noise/RESULTS.md) adds synthetic text damage.
[Experiment 05](../05-llm-side-by-side/RESULTS.md) compares Jev with a scanner's
production LLM request. Testing complete package labels—including warnings and
gluten-free claims—remains a separate step.
