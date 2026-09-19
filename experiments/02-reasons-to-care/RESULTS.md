# 02-reasons-to-care — results

Run 2026-09-18, model `jev-1.13.0`, SDK `0.6.0`. Same 129 real header-only
items as experiment 01. Aggregates only; no real email content in this file.

## The 2×2: question shape × personal context

Positives are the 23 needs-attention emails. "Confident miss" means a
needs-attention email labelled routine, the one outcome that can't be rescued
by escalating uncertain mail to an LLM.

| | flagged | left uncertain | **confident miss** | routine settled | routine falsely flagged | coverage at conf ≥ 0.9 | ranking AUC |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 one Choice | 10–12 of 23 | 9–11 | **2** | 97 of 105 | 1 | 72% at 100% | 0.970 |
| 01 one Choice + context | 9 | 12 | **2** | 97 | 1 | 73% at 100% | 0.979 |
| 02 Noul per reason | 19 | 4 | **0** | 59 | 5 | 30% at 97% | 0.949 |
| **02 Noul per reason + context** | **20** | **3** | **0** | **97** | **3** | **69% at 100%** | 0.976 |

## What it says

1. **Question shape did what context alone could not.** Splitting "does this
   matter?" into five narrow reasons took confident misses from 2 to 0 and
   outright flags from about half to 83–87%. This is TypeSafe's own
   "decompose, then combine in code" advice, and on this data it holds.
2. **Context did almost nothing for the single Choice, and a lot for the
   Nouls.** Without context the Nouls were jumpy: 41 routine emails landed in
   uncertain and coverage collapsed to 30%. With six lines about the recipient,
   36 of those settled back to routine with no loss of recall. Context did not
   make the model find more; it let it stop worrying about what doesn't matter
   to this person.
3. **The best cell decides 94% of mail outright** (121 of 129) and escalates 8.
   Of the 97 it called routine, all 97 agreed with the baseline classifier.
4. **The three "false flags" are arguable, not blunders:** two security or
   account notices and one appointment reminder. The baseline saw the first
   200 characters of each body and judged them routine. A person might side
   with either.
5. **The three left uncertain:** two needed knowledge of the recipient's own
   projects, which the context did not include, and one was a notification
   about a message on another platform. More context would plausibly move the
   first two.
6. **Which reasons fired on correct flags:** money 12, security 5, care
   provider 3. `person_waiting` and `opportunity` never led, because the mail
   most likely to trigger them (real conversation threads) was dropped from
   the sample as ambiguous. Those two questions are effectively untested.

## Noise floor

Same inputs, same pinned model, repeated runs:

- 01 plain, 2 runs: 2 of 129 labels changed (both between flagged and
  uncertain, around the 0.6 cut-off). That is why the first row is a range.
- 02 + context, 3 runs: 0 of 129 labels changed; individual Noul scores moved
  by up to 0.13.

So differences of two or three emails between cells are inside the noise. The
gaps this write-up leans on (confident misses 2 → 0, uncertain routine 41 → 5)
are well outside it.

## Cost

Context adds ~250–300 input tokens per email. Best cell: ~830 input tokens per
email, p50 159 ms. At the $0.042 per 1M input tokens quoted in TypeSafe's
cookbooks (not an official price sheet), 1,000 emails ≈ $0.035.

## Cost against the baseline classifier

The baseline calls Claude Haiku 4.5 once per email with a long system prompt,
a tool schema, the headers and a short body snippet: roughly 3,250 input and
60 output tokens. At $1 / $5 per 1M tokens that is about **$3.55 per 1,000
emails**. (Estimated from the request shape, not from logged usage.)

| | per 1,000 emails | at ~2,470 emails a month |
| --- | --- | --- |
| Baseline: Haiku 4.5 on every email | ~$3.55 | ~$8.80 |
| Jev, best cell, on every email | ~$0.035 | ~$0.09 |
| Hybrid: Jev first, Haiku only on `uncertain` (~5% of real mail) | ~$0.21 | ~$0.52 |

Jev is about 100× cheaper per email. In absolute terms the saving is about
$100 a year, so cost is not the reason to switch; the 159 ms latency and the
calibrated confidence are the more interesting properties.

## Caveats

- **The recipient context was written after the experiment 01 misses had been
  seen.** It was drafted from the baseline classifier's own calibration
  prompt rather than from the misses, and the no-context Noul run already
  caught both of them, but it is not a clean-room input.
- The two thresholds (0.5, 0.2) were fixed before the first run and not tuned.
  They still need a fresh sample.
- 23 positives. `expected` is agreement with an LLM that also saw the first
  200 characters of the body.
- Sender display names were empty for every item.

## Next questions

1. Fresh two weeks, thresholds frozen: does 0 confident misses survive?
2. Real conversation threads, which need per-message lookup: do
   `person_waiting` and `opportunity` earn their place?
3. How little context is enough? Six lines worked; try two.
