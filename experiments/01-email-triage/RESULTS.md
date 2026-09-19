# 01: Can Jev triage email from headers alone?

Run September 18, 2026 · Jev `jev-1.13.0` · SDK `0.6.0`

**Promising as a router, not ready as a replacement.** At confidence ≥ 0.9,
Jev answered on 72% of the 129-email sample and matched the existing Claude
classifier on every answer. At the default threshold, it flagged only 10 of
23 emails the baseline said needed attention.

These are agreement scores, not ground truth. All results are aggregates;
no real email content appears here.

## What I tested

- **Source:** two weeks of one inbox, about 1,000 emails. The baseline uses
  Claude Haiku 4.5, recipient context, and the first 200 body characters.
  About 96% was routine, 3% needed attention, and 1% was handled by a rule.
- **Sample:** all non-routine mail plus 111 seeded random routine emails: 150
  total. I excluded 11 ambiguous thread lookups and 10 outage-generated labels,
  leaving **129 items: 23 needs-attention, 105 routine, 1 uncertain.**
- **Jev's input:** sender address and subject only. The lookup returned no
  sender display names. No body or personal context in the first run.
- **Questions:** one Choice between `needs-attention` and `routine`, plus three
  yes/no scores (Nouls). The Choice became `uncertain` below 0.6 confidence.

## Raising the confidence threshold

A router answers when confident and sends everything else to the LLM.
Coverage is the share it answers; agreement is measured within that share.

| Confidence ≥ | Coverage | Agreement with baseline |
| --- | --- | --- |
| 0.5 | 87.6% | 94.7% |
| 0.7 | 82.2% | 97.2% |
| 0.8 | 77.5% | 99.0% |
| 0.9 | 72.1% | 100.0% |
| 0.95 | 69.0% | 100.0% |

The 0.5 row includes `uncertain` outputs under the default 0.6 rule; it is not
all mail resolved without a fallback. The sample also over-represents
non-routine mail, so these coverage rates are not estimates for the full inbox.

## What the default rule missed

At the default 0.6 threshold:

| Class | Expected | Predicted | Recall | Precision |
| --- | --- | --- | --- | --- |
| needs-attention | 23 | 11 | 43.5% | 90.9% |
| routine | 105 | 99 | 92.4% | 98.0% |
| uncertain | 1 | 19 | 100.0% | 5.3% |

| Expected ↓ / predicted → | needs-attention | routine | uncertain |
| --- | --- | --- | --- |
| needs-attention | 10 | 2 | 11 |
| routine | 1 | 97 | 7 |
| uncertain | 0 | 0 | 1 |

Jev flagged or deferred 21 of the 23 needs-attention emails. **It called the
other two routine**, so an LLM fallback on `uncertain` would not rescue them.
Both were automated account alerts whose importance depended on the recipient.
Jev also flagged one of the 105 routine emails.

## The first problem was in the baseline

The first run appeared to have 33% recall. Eight of ten apparent misses were
marketing emails labeled `needs-attention` with the reason
`classifier unavailable`. The baseline defaults to flagging mail when its LLM
is down, and an outage fell inside the sample window.

Those were outage artifacts, not judgments Jev should match. **Check the
baseline's reasons before treating its labels as the answer key.**

## Did personal context help?

Adding six lines of recipient context (`--context`) barely changed the result:
9 flagged, 12 uncertain, 2 needs-attention emails called routine, and 97 routine
emails correctly settled. Ranking AUC rose from 0.970 to 0.979.

The two account alerts moved to uncertain, but two other emails moved to
routine. A plain-run repeat changed 2 of 129 labels on its own. Context alone
did not resolve the problem; [experiment 02](../02-reasons-to-care/RESULTS.md)
tests narrower questions.

## Speed and cost

- Median latency: 177 ms; 95th percentile: 248 ms, with four questions per call.
- About 500 input tokens per email, only ~30 of them from the email itself;
  about 89 billed output tokens.
- Estimated cost: **$0.02 per 1,000 emails**, using the $0.042 per million input
  tokens and free output quoted in TypeSafe's cookbooks, not an official price
  sheet.

## Limits and next steps

- Only 23 needs-attention emails: one changes recall by four percentage points.
- Claude saw body snippets; Jev did not. Neither is ground truth.
- Excluded threads included five needs-attention emails, mostly conversations.
- Thresholds were assessed on this sample. The 100% agreement needs validation.

Next: test narrower reasons an email might matter
([done in experiment 02](../02-reasons-to-care/RESULTS.md)), recover individual
messages from threads, and repeat on a fresh two weeks with thresholds frozen.
