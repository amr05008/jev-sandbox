# 07: Barcode bake-off: Opus 4.8 vs Haiku 4.5 vs Jev + rules

Run September 24, 2026:
- **The scanner request:** GlutenOrNot's production barcode request at
  commit `5951abe`;
- **The models:** Claude Opus 4.8 and Claude Haiku 4.5, plus Jev
  `jev-1.13.0` with a rule written in code.

**Jev plus a few code rules agreed with Claude Opus 4.8 on 99.7% of 796 real
barcode records it had never seen, and answered in 0.20 s instead of 3.03 s.**
It settled about half the records on its own and sent the rest to Claude.
Haiku 4.5 was about a second faster than Opus, but it called a
self-contradicting record `safe` five times out of five, so it's out. These
results are why GlutenOrNot now runs Jev in production in shadow mode (more
below).

> **Not medical advice.** `safe` is a model output label, not a determination
> that a food is safe to eat. Agreement with Claude isn't clinical accuracy.

## The setup

I wanted to know whether a faster engine could give the same barcode
verdicts as the scanner's Opus request, with zero false-safe, and how much
faster.

| Engine | What it is |
| --- | --- |
| Opus 4.8 | The scanner's production barcode request, byte for byte: its prompt, its cache marker, `max_tokens` 2048 |
| Haiku 4.5 | The same request, with only the model id changed |
| Jev + rules | The scanner's own tag checks run first. Jev then answers yes/no questions about the ingredient text only, and a rule in code settles a clear `unsafe` or `safe`. Everything else goes to Claude. |

**Two datasets:**
- **D1:** the scanner's 30 frozen, synthetic barcode test cases. Claude is
  sampled 2× for cases expected safe and 5× for the rest.
- **D2:** experiment 05's 996 Open Food Facts products, re-fetched with their
  allergen, trace and label tags.

**How I kept myself honest:**
- **Pass mark:** zero false-safe verdicts. Any confirmed one knocks an engine
  out.
- **A tuning set and a test set.** I tuned Jev's questions only on D1 and D2
  items 1–200, then graded the chosen version on items 201–996, which no
  version had seen.

## Results

**D1, the frozen cases:**

| Engine | False-safe samples | Cases passing every sample | Latency p50 |
| --- | --- | --- | --- |
| Opus 4.8 | **0 of 126** | 30/30 | 3.28 s |
| Haiku 4.5 | **5 of 126** (all one case) | 29/30 | 1.89 s |
| Jev + rules | **0** (it settled 10 of 60 samples) | – | 0.18 s |

**D2, items 201–996, graded on unseen data:**

| | Opus 4.8 | Jev v1 → Opus | Jev v2 → Opus |
| --- | --- | --- | --- |
| Settled without Claude | – | 55.4% | 51.3% |
| Agreement with Opus | – | 99.4% | **99.7%** |
| Settled `safe` where Opus wasn't safe | – | 4 | 1 |
| `safe` on a label that lists gluten | 8, all correct (gluten-free-labeled oats) | 0 | 0 |
| Latency p50 / p95 | 3.03 / 4.80 s | 0.17 / 4.04 s | 0.20 / 4.15 s |

Jev on its own ran at 0.14 s p50 and 0.19 s p95, with 0 errors in 795 calls.
The p95 of the "→ Opus" columns is high because a record Jev doesn't settle
still waits for Claude.

## What went wrong, and what fixed it

- **Haiku 4.5 skipped the fine print.** The failing case was a record with a
  gluten-free label and a gluten allergen tag, but no oats and no gluten grain
  in the list.
  - The scanner's prompt says to call that a conflict, never `safe`.
  - Opus followed it 5/5 times.
  - Haiku said `safe` with high confidence 5/5 times, arguing that unverified
    label text "corroborates" the claim, which the prompt forbids.
- **Jev v1 called texts that weren't really ingredient lists `safe`.** There
  were five on the tuning set:
  - nutrition figures in the ingredients field (twice);
  - dosage instructions for a medicine;
  - garbled photo text;
  - a list cut off mid-word.

  None was a missed gluten word, but the scanner treats an incomplete list as
  caution, never a guessed safe. v2 added two narrow questions ("is this an
  ingredient list?" and "does it look complete?"), and on the unseen items
  they caught all three texts of this kind that v1 called safe.
- **Jev read rice semolina as wheat.** v1 scored "semoule de riz" 0.65 on
  wheat. v2's wheat question counts semolina only when it's made from wheat.
- **v2's one false safe was a tag parser, not Jev.** It came from an Italian
  tofu record whose trace tag is written `en:Glutine`. The scanner's
  `isGlutenFamilyTag` only matched lowercase English "gluten", so the rule
  never saw the trace warning. About a dozen other gluten tags in the data
  had the same problem (`en:trigo`, `en:Weizenmehl`, `nl:Tarwee` and so on).
  In GlutenOrNot, the fix makes a fast `safe` require every tag to be on a
  short allowlist, so unfamiliar tags fail closed.

Across all 996 records and 30 cases, Jev never called a label `safe` when the
list named a gluten ingredient. Every false safe came from the code around it.

## What this doesn't show

- **Real phone scans.** This is a public sample, EU-heavy across six
  languages. GlutenOrNot's users are mostly in the US, and a third of their
  barcode scans carry a gluten-free label, which this rule sends to Claude.
- **A fresh grade for the final rule.** The tag allowlist was written after I
  saw the tofu miss, so its unit tests prove the fix but it wasn't re-graded
  on new data. I chose a staged production rollout instead (below).
- **Speed from a server.** Everything here was timed from my Mac. In
  production, from Vercel, Jev has answered in 120–282 ms so far.
- **Clinical review of any verdict.**
- **Photos, menus, and the non-Open-Food-Facts barcode sources.**

## What happened next

GlutenOrNot shipped this as a staged fast path (its decision 007):
- **Claude still runs on every scan.** When Jev settles a record, the answer
  can go out at once, and Claude finishes in the background as an audit.
- **Shadow mode first:** Jev is asked but never shown.
- **Then `unsafe` only,** since a wrong unsafe can't hurt anyone.
- **Then `safe` too,** only after at least 50 shadowed Jev safes over at
  least 3 weeks with none disputed, plus a check on the product name for meat
  products.

## Cost

About $8.49 of Claude across every run, including Haiku, the smoke tests and
the graded run. Jev cost pennies.

## Run it

See [README.md](README.md). You need a GlutenOrNot checkout at or after
`5951abe` (its `api/barcode.js` must export `GLUTEN_GRAIN_PATTERN`), plus
`TYPESAFE_API_KEY` and a spend-capped `ANTHROPIC_API_KEY` in `.env`.
