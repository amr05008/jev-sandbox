import { readFileSync } from "node:fs";
import { readJsonl, writeJsonl, type Item } from "../lib/items.ts";
import type { State } from "../experiments/01-email-triage/questions.ts";

// Joins looked-up headers to the baseline classifier's labels by Message-ID
// and writes experiment 01's real items. Everything it reads and writes is
// under data/real/, which is gitignored.
//
// node scripts/build-email-items.ts

const dir = `${import.meta.dirname}/../experiments/01-email-triage/data/real`;

interface Header {
  n: number;
  msgid: string;
  sender?: string;
  subject?: string;
  ambiguous?: boolean;
  found?: boolean;
}

/** Split `Display Name <addr@host>` into its parts; bare addresses get an empty name. */
export function parseSender(sender: string): { name: string; email: string } {
  const m = sender.match(/^\s*"?(.*?)"?\s*<([^<>]+)>\s*$/);
  return m ? { name: m[1]!.trim(), email: m[2]!.trim() } : { name: "", email: sender.trim() };
}

// The baseline's decisions, keyed by Message-ID. Its one-line reason matters:
// when its model is unavailable it fails open to needs-attention, and those
// rows are outage artifacts, not judgments. They must not count as ground truth.
const BASELINE_UNAVAILABLE = "classifier unavailable";
const labels: Record<string, { class: string; reason: string }> = JSON.parse(
  readFileSync(`${dir}/labels.json`, "utf8"),
);
const failedOpen = (msgid: string): boolean => labels[msgid]?.reason === BASELINE_UNAVAILABLE;
const headers = readJsonl<Header>(`${dir}/headers.jsonl`);

const items: Item<State>[] = [];
const skipped = { notFound: 0, ambiguous: 0, noLabel: 0, failedOpen: 0 };
for (const h of headers) {
  if (h.found === false || h.sender === undefined) skipped.notFound++;
  else if (h.ambiguous) skipped.ambiguous++;
  else if (!labels[h.msgid]) skipped.noLabel++;
  else if (failedOpen(h.msgid)) skipped.failedOpen++;
  else {
    const { name, email } = parseSender(h.sender);
    items.push({
      // Position in the sample, not the Message-ID: ids end up in raw/ and logs.
      id: `real-${String(h.n).padStart(3, "0")}`,
      state: { sender_name: name, sender_email: email, subject: h.subject ?? "(no subject)" },
      expected: labels[h.msgid]!.class,
    });
  }
}

writeJsonl(`${dir}/items.jsonl`, items);
const counts: Record<string, number> = {};
for (const i of items) counts[i.expected!] = (counts[i.expected!] ?? 0) + 1;
console.log(`items: ${items.length}`, counts, "skipped:", skipped);
