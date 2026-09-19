import { existsSync, readdirSync } from "node:fs";
import { readJsonl, writeJsonl, type Item, type RunRecord } from "../../lib/items.ts";
import { upper95 } from "../../lib/score.ts";
import { glutenWords } from "../03-gluten-labels/keywords.ts";
import type { State } from "../03-gluten-labels/questions.ts";

// Paired comparison: the scanner's production LLM request against Jev, on the
// same labels. Reads Jev's existing runs from experiments 03 and 04.
//
// The two were given different policies, so raw agreement would mislead. The
// LLM's prompt says `caution` for anything ambiguous; Jev's rule says `safe`
// unless a gluten source or a may-contain statement is found. So this scores
// what each does with gluten that is visibly listed, how often each refuses to
// commit, and what they cost, separately.
//
// node experiments/05-llm-side-by-side/compare.ts

interface LlmRow {
  id: string;
  group: string;
  expected: string;
  verdict: string | null;
  latencyMs: number;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number };
  text: string;
}
const dir = import.meta.dirname;
const latestRaw = (exp: string, head: string) => {
  const f = readdirSync(`${dir}/../${exp}/raw`).filter((n) => n.startsWith(`public-${head}-2`)).sort().at(-1);
  if (!f) throw new Error(`no ${exp}/raw/public-${head}-* run found`);
  return new Map(readJsonl<RunRecord>(`${dir}/../${exp}/raw/${f}`).map((r) => [r.id, r]));
};
const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}%`);
const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]!;
const llmCost = (rows: LlmRow[]) =>
  rows.reduce((s, r) => s + (r.usage.input_tokens * 5 + r.usage.cache_read_input_tokens * 0.5 + r.usage.cache_creation_input_tokens * 6.25 + r.usage.output_tokens * 25) / 1e6, 0);
const count = <T>(xs: T[], key: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});

// ---------- clean labels ----------
const llm = readJsonl<LlmRow>(`${dir}/raw/claude-clean.jsonl`);
const jev = latestRaw("03-gluten-labels", "nouls");
const text = new Map(readJsonl<Item<State>>(`${dir}/../03-gluten-labels/data/public/items.jsonl`).map((i) => [i.id, i.state.ingredients]));
const pairs = llm.filter((r) => r.verdict && jev.has(r.id)).map((r) => ({ id: r.id, llm: r.verdict!, jev: jev.get(r.id)!.predicted, db: r.expected, lang: r.group, words: glutenWords(text.get(r.id)!) }));

console.log(`# Clean labels: ${pairs.length} paired (${llm.length - pairs.length} LLM replies could not be parsed)\n`);
console.log("## Verdicts, side by side\n");
const verdicts = ["unsafe", "caution", "uncertain", "safe"];
console.log(`| LLM ↓ / Jev → | ${verdicts.join(" | ")} |`);
console.log(`| --- | ${verdicts.map(() => "---").join(" | ")} |`);
for (const l of ["unsafe", "caution", "safe"]) console.log(`| ${l} | ${verdicts.map((j) => pairs.filter((p) => p.llm === l && p.jev === j).length).join(" | ")} |`);

const listed = pairs.filter((p) => p.words.length > 0);
const clear = pairs.filter((p) => p.words.length === 0 && p.db === "safe");
console.log(`\n## Labels where the keyword witness sees a gluten word (${listed.length})\n`);
console.log("| | called `safe` | called `unsafe` | 95% upper bound on the `safe` rate |");
console.log("| --- | --- | --- | --- |");
for (const who of ["llm", "jev"] as const) {
  const safe = listed.filter((p) => p[who] === "safe").length;
  console.log(`| ${who === "llm" ? "LLM" : "Jev"} | ${safe} | ${pct(listed.filter((p) => p[who] === "unsafe").length, listed.length)} | ${pct((upper95(safe, listed.length) ?? 0) * listed.length, listed.length)} |`);
}
console.log("\n(Every `safe` here needs reading: in experiment 03 they were all keyword errors such as gluten-free oats.)");

console.log(`\n## Labels with no gluten word, tagged safe by the database (${clear.length}): who commits?\n`);
console.log("| | `safe` | will not commit (`caution` / `uncertain`) | `unsafe` |");
console.log("| --- | --- | --- | --- |");
for (const who of ["llm", "jev"] as const) {
  const c = count(clear, (p) => p[who]);
  console.log(`| ${who === "llm" ? "LLM" : "Jev"} | ${pct(c.safe ?? 0, clear.length)} | ${pct((c.caution ?? 0) + (c.uncertain ?? 0), clear.length)} | ${pct(c.unsafe ?? 0, clear.length)} |`);
}

const jevRows = pairs.map((p) => jev.get(p.id)!);
const jevTokens = jevRows.reduce((s, r) => s + r.inputTokens, 0);
console.log("\n## Speed and cost\n");
console.log("| | latency p50 | latency p95 | cost per 1,000 labels |");
console.log("| --- | --- | --- | --- |");
console.log(`| LLM | ${(quantile(llm.map((r) => r.latencyMs), 0.5) / 1000).toFixed(2)} s | ${(quantile(llm.map((r) => r.latencyMs), 0.95) / 1000).toFixed(2)} s | $${((llmCost(llm) / llm.length) * 1000).toFixed(2)} |`);
console.log(`| Jev | ${(quantile(jevRows.map((r) => r.latencyMs), 0.5) / 1000).toFixed(2)} s | ${(quantile(jevRows.map((r) => r.latencyMs), 0.95) / 1000).toFixed(2)} s | $${(((jevTokens / jevRows.length) * 0.042) / 1e6 * 1000).toFixed(3)} |`);
console.log("\n(LLM latency measured at concurrency 4, Jev at 8; LLM cost from billed usage with prompt caching; Jev at $0.042 per 1M input tokens.)");

const hard = pairs.filter((p) => (p.llm === "safe") !== (p.jev === "safe") || (p.words.length > 0 && (p.llm === "safe" || p.jev === "safe")));
writeJsonl(`${dir}/raw/disagreements-clean.jsonl`, hard.map((p) => ({ ...p, text: text.get(p.id), llm_reply: llm.find((r) => r.id === p.id)!.text })));
console.log(`\nrows where exactly one of them said \`safe\`, or either said \`safe\` on a label with a gluten word: ${hard.length} → raw/disagreements-clean.jsonl`);

// ---------- truncated labels ----------
if (existsSync(`${dir}/raw/claude-cuts.jsonl`)) {
  const cuts = readJsonl<LlmRow>(`${dir}/raw/claude-cuts.jsonl`).filter((r) => r.verdict);
  const ungated = latestRaw("04-ocr-noise", "ungated");
  const gated = latestRaw("04-ocr-noise", "gated");
  const NOTICED = /incomplete|cut off|cut-off|truncat|partial|appears to (start|begin|end)|mid-|fragment|missing (the )?(start|beginning|end)|not the full/i;
  console.log(`\n# Truncated gluten labels: ${cuts.length}\n`);
  console.log("Every one of these products contains gluten. `safe` is the dangerous answer.\n");
  console.log("| damage | labels | LLM `safe` | LLM reply mentions the text looks cut off | Jev `safe`, no gate | Jev `safe`, with completeness gate |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const v of ["cut-end-50", "cut-start-50"]) {
    const rows = cuts.filter((r) => r.group === v);
    console.log(
      `| ${v} | ${rows.length} | ${rows.filter((r) => r.verdict === "safe").length} | ${pct(rows.filter((r) => NOTICED.test(r.text)).length, rows.length)} | ${rows.filter((r) => ungated.get(r.id)?.predicted === "safe").length} | ${rows.filter((r) => gated.get(r.id)?.predicted === "safe").length} |`,
    );
  }
  console.log(`\nLLM verdicts on these: ${JSON.stringify(count(cuts, (r) => `${r.group}:${r.verdict}`))}`);
}
