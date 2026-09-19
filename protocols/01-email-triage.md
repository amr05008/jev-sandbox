# Protocol: 01-email-triage

How the real-data run was produced. Everything named here lives under
`experiments/01-email-triage/data/real/` (gitignored).

1. **Labels.** Export the existing classifier's stored decisions for the last
   14 days, keyed by RFC822 Message-ID, each with its class and its one-line
   reason → `labels.json`.
2. **Sample.** Drop rows labelled by a rule rather than the model. Take every
   non-routine row plus 111 random routine rows, seed `20260918` →
   `sample-lookups.json` (Message-IDs only).
3. **Headers.** For each Message-ID, one read-only mailbox search by
   Message-ID, recording sender and subject only → `headers.jsonl`. Done once,
   with the inbox owner's approval. Lookups that return more than one message
   are marked ambiguous.
4. **Join.** `node scripts/build-email-items.ts` → `items.jsonl`. Drops
   not-found, ambiguous, and rows whose baseline reason is
   `classifier unavailable` (the baseline failed open during a model outage;
   those are artifacts, not judgments). Item ids are sample positions, never
   Message-IDs.
5. **Context.** Optional `recipient.json`: a few non-identifying lines about
   what the inbox owner does and does not care about. Used only with
   `--context`.
6. **Run.** `node --env-file=.env experiments/01-email-triage/run.ts --real`.
   Model pinned in `lib/client.ts`.
7. **Write up.** Aggregates only into `RESULTS.md`.
