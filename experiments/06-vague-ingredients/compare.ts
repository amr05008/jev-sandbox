import { readdirSync } from "node:fs";
import { readJsonl, type RunRecord } from "../../lib/items.ts";
import { VAGUE } from "./questions.ts";

// Does adding the vague-ingredient policy make Jev's verdicts match the LLM's?
// Pairs this experiment's heads with experiment 05's LLM replies on the same labels.
//
// node experiments/06-vague-ingredients/compare.ts

const dir = import.meta.dirname;
const head = (name: string) => {
  const f = readdirSync(`${dir}/raw`).filter((n) => n.startsWith(`public-${name}-2`)).sort().at(-1);
  if (!f) throw new Error(`no raw/public-${name}-* run found`);
  return new Map(readJsonl<RunRecord & { answers: Record<string, { noul: number }> }>(`${dir}/raw/${f}`).map((r) => [r.id, r]));
};
const llm = readJsonl<{ id: string; verdict: string | null; text: string }>(`${dir}/../05-llm-side-by-side/raw/claude-clean.jsonl`).filter((r) => r.verdict);
const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}%`);
// The LLM has no `uncertain`; for matching, Jev's `uncertain` plays the same role as `caution`.
const fold = (v: string) => (v === "uncertain" ? "caution" : v);

console.log(`${llm.length} labels paired with the LLM\n`);
console.log("| Jev rule | same verdict as the LLM | LLM `caution` also not `safe` for Jev | both `safe` | LLM `safe`, Jev not | Jev `safe`, LLM not |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const name of ["base", "policy", "policy_compound"]) {
  const jev = head(name);
  const pairs = llm.map((r) => ({ llm: r.verdict!, jev: fold(jev.get(r.id)!.predicted) }));
  const llmCaution = pairs.filter((p) => p.llm === "caution");
  console.log(
    `| ${name} | ${pct(pairs.filter((p) => p.llm === p.jev).length, pairs.length)} | ${pct(llmCaution.filter((p) => p.jev !== "safe").length, llmCaution.length)} | ${pairs.filter((p) => p.llm === "safe" && p.jev === "safe").length} | ${pairs.filter((p) => p.llm === "safe" && p.jev !== "safe").length} | ${pairs.filter((p) => p.jev === "safe" && p.llm !== "safe").length} |`,
  );
}

const policy = head("policy");
console.log("\n## Verdicts with the policy rule\n");
const vs = ["unsafe", "caution", "safe"];
console.log(`| LLM ↓ / Jev → | ${vs.join(" | ")} |\n| --- | ${vs.map(() => "---").join(" | ")} |`);
for (const l of vs) console.log(`| ${l} | ${vs.map((j) => llm.filter((r) => r.verdict === l && fold(policy.get(r.id)!.predicted) === j).length).join(" | ")} |`);

console.log("\n## Which vague-ingredient question fires (share of all labels at ≥ 0.5)\n");
console.log(`| ${[...VAGUE, "vague_any", "gf_claim"].join(" | ")} |\n| ${[...VAGUE, "vague_any", "gf_claim"].map(() => "---").join(" | ")} |`);
const all = [...policy.values()];
console.log(`| ${[...VAGUE, "vague_any", "gf_claim"].map((k) => pct(all.filter((r) => r.answers[k]!.noul >= 0.5).length, all.length)).join(" | ")} |`);
