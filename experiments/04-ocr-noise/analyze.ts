import { readdirSync } from "node:fs";
import { readJsonl, type Item, type RunRecord } from "../../lib/items.ts";
import { upper95 } from "../../lib/score.ts";
import type { State } from "../03-gluten-labels/questions.ts";
import { COMPLETE_AT } from "./questions.ts";

// Per-damage breakdown. The generic summary mixes all variants together, which
// hides the only thing this experiment is about.
//
// node experiments/04-ocr-noise/analyze.ts

interface Meta {
  variant: string;
  gluten_visible: boolean;
}
const dir = import.meta.dirname;
const latest = (head: string) => {
  const f = readdirSync(`${dir}/raw`).filter((n) => n.startsWith(`public-${head}-2`)).sort().at(-1);
  if (!f) throw new Error(`no raw/public-${head}-* run found; run with --public first`);
  return readJsonl<RunRecord & { answers: { complete: { noul: number } } }>(`${dir}/raw/${f}`);
};
const items = new Map(readJsonl<Item<State> & { meta: Meta }>(`${dir}/data/public/items.jsonl`).map((i) => [i.id, i]));
const ungated = latest("ungated");
const gateHead = process.argv.find((a) => a.startsWith("--gate="))?.split("=")[1] ?? "gated";
const gated = new Map(latest(gateHead).map((r) => [r.id, r]));
console.log(`gate: ${gateHead}\n`);

const variants = [...new Set(ungated.map((r) => r.group!))];
const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}%`);

console.log("## Labels that contain gluten: is it still caught?\n");
console.log("| damage | gluten word still readable | flagged | called `safe` | …of which the completeness gate stops | **`safe` after the gate** |");
console.log("| --- | --- | --- | --- | --- | --- |");
let totalSafeAfterGate = 0;
let totalGluten = 0;
let readable = 0;
for (const v of variants) {
  const rows = ungated.filter((r) => r.group === v && r.expected === "unsafe");
  const safe = rows.filter((r) => r.predicted === "safe");
  const stillSafe = safe.filter((r) => gated.get(r.id)!.predicted === "safe");
  readable += stillSafe.filter((r) => items.get(r.id)!.meta.gluten_visible).length;
  const visible = rows.filter((r) => items.get(r.id)!.meta.gluten_visible).length;
  totalSafeAfterGate += stillSafe.length;
  totalGluten += rows.length;
  console.log(
    `| ${v} | ${pct(visible, rows.length)} | ${pct(rows.filter((r) => r.predicted === "unsafe").length, rows.length)} | ${safe.length} | ${safe.length - stillSafe.length} | **${stillSafe.length}** |`,
  );
}
console.log(
  `\nAcross all damage: ${totalSafeAfterGate} of ${totalGluten} gluten labels ended as \`safe\` after the gate ` +
    `(${pct(totalSafeAfterGate, totalGluten)}; 95% upper bound ${((upper95(totalSafeAfterGate, totalGluten) ?? 0) * 100).toFixed(2)}%).`,
);

console.log(
  `Of those ${totalSafeAfterGate}, the gluten word was still readable in ${readable}: those are reading misses. ` +
    `In the other ${totalSafeAfterGate - readable} the damage removed it, so only noticing the damage could have helped.`,
);

console.log("\n## Labels without gluten: what does the gate cost?\n");
console.log("| damage | called `safe` before the gate | after the gate | sent to fallback by the gate |");
console.log("| --- | --- | --- | --- |");
for (const v of variants) {
  const rows = ungated.filter((r) => r.group === v && r.expected === "safe");
  const before = rows.filter((r) => r.predicted === "safe").length;
  const after = rows.filter((r) => gated.get(r.id)!.predicted === "safe").length;
  console.log(`| ${v} | ${pct(before, rows.length)} | ${pct(after, rows.length)} | ${pct(before - after, rows.length)} |`);
}

console.log(`\n## Does the completeness question see the damage? (share answering below ${COMPLETE_AT})\n`);
console.log("| damage | judged incomplete | median score |");
console.log("| --- | --- | --- |");
for (const v of variants) {
  const scores = ungated.filter((r) => r.group === v).map((r) => r.answers.complete.noul).sort((a, b) => a - b);
  console.log(`| ${v} | ${pct(scores.filter((s) => s < COMPLETE_AT).length, scores.length)} | ${scores[Math.floor(scores.length / 2)]!.toFixed(2)} |`);
}
