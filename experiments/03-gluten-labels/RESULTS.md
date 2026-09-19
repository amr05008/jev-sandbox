# 03-gluten-labels — results

Run 2026-09-18, model `jev-1.13.0`, SDK `0.6.0`. 3,300 ingredient lists from
Open Food Facts, 550 per language (en, es, fr, nl, de, it). Public data, so
examples appear below.

> **Not medical advice.** Nothing here is validated for deciding what a person
> with celiac disease can eat. It is one run, against imperfect references.

## Headline

**Across 1,471 labels that visibly list a gluten ingredient, Jev called none of
them safe.** With zero misses that puts the 95% upper bound on its miss rate at
about 0.2%. It got there in six languages with no glossary, at a median 170 ms
and about $0.035 per 1,000 labels.

The route to that sentence is the more useful story, because the first answer
the experiment gave was very different.

## Against the database's own tags, it looks bad

`expected` came from Open Food Facts' allergen and trace tags. Scored that way:

| head | given `safe` | wrong | wrong rate | at confidence ≥ 0.95 |
| --- | --- | --- | --- | --- |
| one Choice | 1,553 | 114 | 7.3% | 6.8% |
| Noul per source | 1,574 | 125 | 7.9% | 6.8% |
| both must agree | 1,572 | 124 | 7.9% | 6.6% |

A 7% wrongly-safe rate would end the conversation. But look at the last
column: **raising the confidence bar does nothing.** A model that is wrong
because it is unsure gets better as you demand more confidence. A flat line
means it is just as sure when it is "wrong" as when it is right, and that
points at the labels, not the model.

## The labels were wrong more often than the model

`analyze.ts` adds a second, independent witness: a deliberately dumb
multilingual keyword list run over the same text. Where the two disagree, the
rows were read one at a time during analysis (with an AI assistant, not by a
dietitian).

| database says | keyword list | Jev | count | what reading them shows |
| --- | --- | --- | --- | --- |
| safe | sees gluten | unsafe | 486 | The text lists wheat flour, barley malt and so on. The database is missing the tag. **Jev is right.** |
| safe | sees gluten | safe | 18 | All are oats explicitly marked gluten-free. **Keyword error.** |
| caution | nothing | safe | 113 | The may-contain warning is not in the ingredient text; OFF stores it in another field. **Nothing to read.** |
| unsafe | nothing | safe | 11 | All 11 read in full: none lists a gluten ingredient; one says "gluten- und laktosefrei". **The tag is wrong.** |
| unsafe | sees gluten | unsafe | 861 | Agreement. |
| safe | nothing | safe | 1,431 | Agreement. |

- **25% of products tagged safe visibly contain gluten** (507 of 2,040). Jev
  flagged 486 of them; nearly all the rest are gluten-free oats.
- Of the 125 "wrongly safe" calls, 113 were may-contain products whose warning
  was never in the input, 11 were wrong database tags, and 1 was corn and rice
  semolina. **None was a gluten ingredient the model failed to see.**
- Only 195 of 360 may-contain products carry that wording in their ingredient
  text at all.

Lesson, for the second experiment running: **audit the reference before
trusting the score.** Experiment 01's baseline had failed open during an
outage; this one's is crowd-sourced and under-tagged.

## Where a model beats a keyword list

Every one of the 19 cases where the keyword list saw gluten and Jev said safe
was the keyword list's mistake:

- `Copos de avena integral sin gluten`, `haver (glutenvrij)`, `Glutenfreie
  Vollkorn-Haferflocken`, `farine d'avoine sans gluten`: gluten-free oats, in
  five languages. The question asked about oats "not described as
  gluten-free", and the model honoured that everywhere.
- `sémola de maíz, sémola de arroz`: corn and rice semolina.

Going the other way, Jev flagged things the keywords cannot: `farina tipo "0"`,
`Farina 00` and Dutch `bloem` (flour, meaning wheat flour, with the word wheat
absent), and `aroma's (bevat GLUTEN)`.

A footnote on the keyword list itself: its first two versions silently missed
`blé` and `Hartweizengrieß`, because JavaScript's `\b` and `\w` are ASCII-only.
Multilingual keyword matching is harder to get right than it looks, which is
part of the case for a model here.

## Where it is over-cautious

255 labels had no gluten keyword and Jev still did not say safe: 113 called
caution, 142 unsafe or uncertain. Reading a sample of the 142: roughly half are
real catches like the ones above, or may-contain statements that name wheat; a
quarter are arguable (`glutenfreie Weizenstärke`, gluten-free wheat starch);
a quarter are over-caution on maltodextrin, maltose syrup or unnamed starch,
plus a few plain errors (rye on a spiced butter). That is the cheap direction
to be wrong in, and the natural set to hand to a fallback model.

One design wrinkle: "may contain wheat" makes the wheat question fire, so the
code rule calls it unsafe rather than caution (110 of 360 may-contain
products). Over-severe, not dangerous, and fixable by asking the source
questions about ingredients only.

## One Choice or a Noul per source?

On this task it barely matters: the two heads agree on what is safe (1,553 vs
1,574, nearly the same items), and requiring both changes almost nothing. That
differs from experiment 02, where splitting the question was the whole win.
The likely reason is that "does this list contain a gluten source" is already
one narrow judgment; "does this email matter" was several. The Nouls do earn
their place another way: they say *which* source fired, which a product needs
in order to explain itself.

## By language

Wrongly-safe rate against database tags ran from 3% (en) to 10% (fr), which
tracks how well each language's entries are tagged, not how well the model
reads them: the keyword-visible miss count is zero in all six.

## Speed and cost

p50 170 ms, p95 282 ms per label, seven questions per call, 8 calls in flight.
830 input tokens per label. The whole 3,300-label run cost about $0.12 at the
$0.042 per 1M input tokens quoted in TypeSafe's cookbooks.

## What this does not show

- **The reference for the headline is a keyword list plus reading the
  disagreements, not expert review.** A
  gluten ingredient that the keyword list misses *and* Jev misses *and* the
  database misses would be invisible here. The 0.2% bound is conditional on
  that not happening.
- **Clean typed text, not OCR.** A phone photo of a curved package produces
  dropped characters, cut-off lines and merged columns. A truncated list read
  as "safe" is the most dangerous failure for a label scanner and is untested.
- **Ingredient list only.** May-contain statements often sit outside it. A real
  scan has to capture them, or "safe" means less than it says.
- One run, one model version, thresholds fixed in advance but never validated
  on a second sample.
- No comparison yet against the LLM a production scanner would otherwise use.

## Next questions

1. **OCR noise:** corrupt these same labels the way bad photos do, and add a
   Noul for "is this text complete enough to judge?" as the fallback trigger.
2. **Head-to-head with an LLM** on the 255 not-safe-without-a-keyword cases and a sample of
   agreements: where do they differ, and who is right?
3. **The full label, not just the list:** include may-contain and
   gluten-free-claim text and score the three-way verdict properly.
