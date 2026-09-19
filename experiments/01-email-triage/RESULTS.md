# 01-email-triage — results

Run 2026-09-18, model `jev-1.13.0`, SDK `0.6.0`. Aggregates only; no real
email content appears in this file.

## Setup

- **Population:** about two weeks of one inbox, a little over a thousand
  emails, each already classified by an existing LLM email classifier (Claude
  Haiku 4.5, prompt-and-parse, sees the first 200 characters of the body, has
  a personal calibration prompt). About 96% routine, 3% needs-attention, 1%
  labelled by a rule rather than the model (excluded).
- **Sample:** every non-routine email plus 111 random routine ones (seeded),
  150 total. Headers looked up by Message-ID.
- **Dropped:** 11 lookups that resolved to multi-message threads (can't tell
  which message matched), and 10 rows whose baseline label was a fail-open
  artifact from a model outage, not a judgment. **129 items scored:** 23
  needs-attention, 105 routine, 1 uncertain.
- **What Jev saw:** sender address and subject only. Sender display name was
  empty for every item (the lookup tool returns the bare address). No body, no
  personal context.
- **What Jev was asked:** one two-way Choice (needs-attention / routine), turned
  into `uncertain` below 0.6 confidence, plus three Noul side signals.

## Headline

Read as a router, not a replacement: **at confidence ≥ 0.9 Jev settled 72% of
the sample on its own and agreed with Claude on every one of them.**

| confidence ≥ | coverage | agreement |
| --- | --- | --- |
| 0.5 | 87.6% | 94.7% |
| 0.7 | 82.2% | 97.2% |
| 0.8 | 77.5% | 99.0% |
| 0.9 | 72.1% | 100.0% |
| 0.95 | 69.0% | 100.0% |

The sample over-represents non-routine mail. Re-weighted to the real mix,
92% of routine mail (97 of 105) is settled confidently as routine, which is
roughly **89% of model-classified mail never needing the LLM**.

## Where it falls short

| class | expected | predicted | recall | precision |
| --- | --- | --- | --- | --- |
| needs-attention | 23 | 11 | 43.5% | 90.9% |
| routine | 105 | 99 | 92.4% | 98.0% |
| uncertain | 1 | 19 | 100.0% | 5.3% |

| expected ↓ / predicted → | needs-attention | routine | uncertain |
| --- | --- | --- | --- |
| needs-attention | 10 | 2 | 11 |
| routine | 1 | 97 | 7 |
| uncertain | 0 | 0 | 1 |

- As a standalone classifier it is not good enough: it names only 10 of 23
  needs-attention emails outright.
- As a router it is: 21 of 23 (91%) were either flagged or sent to `uncertain`,
  which is the escalate-to-LLM path. **2 of 23 (8.7%) were confidently called
  routine.** Both were the same kind of automated account alert that matters
  only because of who the recipient is. A generic question cannot know that.
- One routine email was flagged (1 of 105).

## The baseline was wrong before Jev was

The first run scored 33% recall. Eight of the ten "misses" were plain
marketing email that the baseline had labelled needs-attention with the
reason `classifier unavailable`: it fails open when its LLM is down, and an
outage fell inside the window. Jev was right; the labels were artifacts.
Lesson for every experiment here: **audit the baseline's reasons before
trusting it as `expected`.**

## Speed and cost

- Latency: p50 177 ms, p95 248 ms per email, four questions per call.
- Tokens: ~500 input per email, of which the email itself is ~30. The questions
  are the cost. ~89 billed output tokens per call.
- Price: TypeSafe's own cookbooks quote $0.042 per 1M input tokens and $0 for
  output (not an official price sheet). At that rate 1,000 emails ≈ $0.02.

## Run 2: with personal context (`--context`)

Six lines describing the recipient and what they do and do not care about were
added to every item's state, and one sentence pointing at them was appended to
the question. Result: no real change. 9 flagged, 12 uncertain, 2 confident
misses, 97 routine settled, AUC 0.979 (plain: 0.970). The two account alerts
missed in run 1 did move, from routine to uncertain, but two other emails
slipped the other way. A repeat of the plain run changed 2 of 129 labels by
itself, so this is inside the noise. Context alone does not fix a single
two-way Choice; see [experiment 02](../02-reasons-to-care/RESULTS.md) for
what did.

## Caveats

- 23 positives is a small number; one email moves recall by 4 points.
- `expected` is agreement with Claude, not truth. Claude also saw the first
  200 characters of the body.
- The 11 dropped threads included 5 needs-attention emails, mostly real
  conversations, which are the most human mail in the set. Their absence
  could cut either way.
- Thresholds (0.6, 0.9) were read off this same sample. They need a second,
  untouched sample before anyone relies on them.

## Next questions

1. Does giving Jev the sender display name and a few lines of personal context
   in `state` recover the two confident misses?
2. Does a separate Noul per reason-to-care (security, billing, a person
   waiting) beat the single two-way Choice on recall?
3. Same thresholds on a fresh two weeks: do they hold?
