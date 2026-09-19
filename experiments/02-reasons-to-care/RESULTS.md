# 02: Do narrower questions improve email triage?

Run September 18, 2026 · Jev `jev-1.13.0` · SDK `0.6.0`

**Yes, on this sample.** Asking separately about reasons an email might matter,
then adding recipient context, left no needs-attention emails labeled routine.
The rule decided 121 of 129 emails outright and left 8 for an LLM fallback.
All 97 emails it called routine matched the baseline.

This reuses experiment 01's header-only sample. It is not a fresh validation
set. Results are aggregate-only.

## What I changed

Instead of one Choice—does this email need attention?—I asked five yes/no
questions (Nouls): money, security, a care provider, a person waiting, and an
opportunity. Code flags an email if any score is ≥ 0.5, calls it routine if
all scores are < 0.2, and otherwise returns `uncertain`.

I tested both question shapes with and without six lines of recipient context.
A **confident miss** below means one of the 23 needs-attention emails was
called routine. Deferring it as `uncertain` does not count as a miss.

| Variant | Flagged, of 23 | Uncertain, of 23 | Confident misses | Routine settled, of 105 | Routine falsely flagged | Coverage / agreement at confidence ≥ 0.9 | Ranking AUC |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01: one Choice | 10–12 | 9–11 | 2 | 97 | 1 | 72% / 100% | 0.970 |
| 01: one Choice + context | 9 | 12 | 2 | 97 | 1 | 73% / 100% | 0.979 |
| 02: Noul per reason | 19 | 4 | 0 | 59 | 5 | 30% / 97% | 0.949 |
| **02: Noul per reason + context** | **20** | **3** | **0** | **97** | **3** | **69% / 100%** | **0.976** |

The 94% decided outright uses the rule above, not the stricter 0.9 confidence
filter in the table. Ranking AUC measures how well the scores put
needs-attention mail ahead of other mail, regardless of threshold.

## What changed in practice

1. **Narrower questions caught what context alone did not.** Both Noul variants
   had zero confident misses and flagged 83–87% of needs-attention mail,
   compared with roughly half for the single Choice.
2. **Context helped the narrow questions dismiss routine mail.** Without it,
   41 routine emails were left uncertain. With it, that fell to 5. The main
   gain was fewer unnecessary escalations, not finding many more important
   emails.
3. **The three false flags were debatable:** two account or security notices
   and one appointment reminder. The baseline saw body snippets and judged
   them routine.
4. **The three uncertain needs-attention emails lacked context:** two needed
   project knowledge; one referred to a message on another platform.
5. **Two questions remain largely untested.** Money led on 12 correct flags,
   security on 5, and care provider on 3. `person_waiting` and `opportunity`
   never led; ambiguous conversation threads were excluded from the sample.

## How repeatable was it?

- Single Choice, two plain runs: 2 of 129 labels changed, both between flagged
  and uncertain near the 0.6 cutoff. That accounts for the range in the table.
- Nouls + context, three runs: no labels changed, though individual scores
  moved by up to 0.13.

The reduction in uncertain routine mail is encouraging. Two confident misses
falling to zero also repeated here, but two emails cannot establish how well
it will generalize.

## Speed and cost

The best variant used ~830 input tokens per email, including ~250–300 for
context, with median latency of 159 ms. Cost estimates use:

- Haiku 4.5: ~3,250 input and 60 output tokens, estimated from the request, at
  $1/$5 per million input/output tokens.
- Jev: $0.042 per million input tokens, as quoted in TypeSafe's cookbooks.

| Approach | Per 1,000 emails | At ~2,470 emails/month |
| --- | --- | --- |
| Haiku 4.5 on every email | ~$3.55 | ~$8.80 |
| Jev on every email | ~$0.035 | ~$0.09 |
| Jev first, Haiku on `uncertain` (~5% at the inbox's class mix) | ~$0.21 | ~$0.52 |

Jev alone is about 100× cheaper at these rates, but the hybrid saves only
about $100 a year at this volume. For me, the speed and selective use of an
LLM are more interesting. The hybrid's coverage still needs validation.

## Limits and next steps

- Recipient context was written after seeing experiment 01's misses. It came
  from the baseline's calibration prompt, and the no-context Nouls already
  caught both misses, but this was not a blind test.
- The Noul thresholds were fixed before the first run, not tuned afterward.
- There are only 23 needs-attention emails. The reference is another LLM,
  which also saw a body snippet. Sender display names were empty throughout.

Next: freeze the questions and thresholds, test a fresh two weeks, and include
real conversation threads. Then try reducing the context from six lines to two.
