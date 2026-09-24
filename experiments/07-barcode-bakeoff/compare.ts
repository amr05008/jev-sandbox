import { existsSync, writeFileSync } from "node:fs";
import { readJsonl } from "../../lib/items.ts";
import { glutenWords } from "../03-gluten-labels/keywords.ts";

// Scores the bake-off from raw/. Prints aggregate tables (safe to publish) and
// writes the rows that need a human look to raw/review-<set>.jsonl (gitignored).
//
// node experiments/07-barcode-bakeoff/compare.ts --set=d1|d2

const set = process.argv.find((a) => a.startsWith("--set="))?.slice(6) ?? "d2";
const dir = import.meta.dirname;
const load = (engine: string) => {
  const path = `${dir}/raw/${engine}-${set}.jsonl`;
  return existsSync(path) ? readJsonl<any>(path) : [];
};
const rows = { opus: load("opus"), haiku: load("haiku"), jev: load("jev") };
const byKey = (rs: any[]) => new Map(rs.map((r) => [r.key, r]));
const opusBy = byKey(rows.opus);
const haikuBy = byKey(rows.haiku);

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "–");
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN;
};
const secs = (ms: number) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(2)} s` : "–");
const review: any[] = [];
const out: string[] = [];
const say = (line = "") => out.push(line);

/** A settled E2 verdict, else the Claude engine's verdict for the same key: the composite a fast path would show. */
const composite = (j: any, fallback: Map<string, any>) => (j.e2?.settled ? j.e2.verdict : fallback.get(j.key)?.verdict);

function latencyTable() {
  say("| Engine | Calls | Latency p50 | p95 | Output tokens p50 | Cost per 1,000 |");
  say("| --- | --- | --- | --- | --- | --- |");
  for (const engine of ["opus", "haiku"] as const) {
    const rs = rows[engine].filter((r) => !r.warm && r.latencyMs);
    if (!rs.length) continue;
    const cost = rs.reduce((n, r) => n + (r.cost ?? 0), 0) / rs.length;
    say(`| ${engine} | ${rs.length} | ${secs(q(rs.map((r) => r.latencyMs), 0.5))} | ${secs(q(rs.map((r) => r.latencyMs), 0.95))} | ${q(rs.map((r) => r.usage?.output_tokens ?? 0), 0.5)} | $${(cost * 1000).toFixed(2)} |`);
  }
  const js = rows.jev.filter((r) => !r.warm && r.nouls);
  if (js.length) {
    say(`| jev (alone) | ${js.length} | ${secs(q(js.map((r) => r.latencyMs), 0.5))} | ${secs(q(js.map((r) => r.latencyMs), 0.95))} | – | ~$0.05 |`);
    for (const [name, fb] of [["opus", opusBy], ["haiku", haikuBy]] as const) {
      // Only when that engine answered every record E2 passed on; otherwise the row would be settled-only and look fast.
      if (!js.every((j) => j.e2.settled || fb.get(j.key)?.latencyMs)) continue;
      const comp = js.map((j) => j.latencyMs + (j.e2.settled ? 0 : fb.get(j.key).latencyMs));
      if (comp.length) say(`| jev + rules, falling through to ${name} | ${comp.length} | ${secs(q(comp, 0.5))} | ${secs(q(comp, 0.95))} | – | – |`);
    }
    const errs = rows.jev.filter((r) => r.error).length;
    const over800 = js.filter((r) => r.latencyMs > 800).length;
    say();
    say(`Jev errors: ${errs}. Jev calls over an 800 ms production timeout: ${over800} of ${js.length} (${pct(over800, js.length)}).`);
  }
}

if (set === "d1") {
  say("## D1: the scanner's frozen barcode cases");
  say();
  say("| Engine | Samples | False-safe | Over-caution (expected safe, got not safe) | Cases passing every sample |");
  say("| --- | --- | --- | --- | --- |");
  const passes = (r: any) =>
    r.expect === "safe" ? r.verdict === "safe"
    : r.expect === "not-safe" ? r.verdict !== "safe"
    : r.expect === "unsafe" ? r.verdict === "unsafe"
    : r.verdict === "caution" && (!r.reason || r.caution_reason === r.reason);
  for (const engine of ["opus", "haiku"] as const) {
    const rs = rows[engine].filter((r) => r.verdict);
    if (!rs.length) continue;
    const fs = rs.filter((r) => r.expect !== "safe" && r.verdict === "safe");
    const over = rs.filter((r) => r.expect === "safe" && r.verdict !== "safe");
    const cases = new Map<string, boolean>();
    for (const r of rs) cases.set(r.id, (cases.get(r.id) ?? true) && passes(r));
    const failing = [...cases].filter(([, ok]) => !ok).map(([id]) => id);
    say(`| ${engine} | ${rs.length} | **${fs.length}**${fs.length ? ` (${[...new Set(fs.map((r) => r.id))].join(", ")})` : ""} | ${over.length} | ${cases.size - failing.length}/${cases.size}${failing.length ? ` (failing: ${failing.join(", ")})` : ""} |`);
    for (const r of rs.filter((r) => !passes(r))) review.push({ why: `${engine} misses its expectation`, ...r });
  }
  const js = rows.jev.filter((r) => r.e2);
  if (js.length) {
    const settled = js.filter((r) => r.e2.settled);
    const fs = settled.filter((r) => r.expect !== "safe" && r.e2.verdict === "safe");
    const fu = settled.filter((r) => r.expect === "safe" && r.e2.verdict === "unsafe");
    const flips = new Map<string, Set<string>>();
    for (const r of js) flips.set(r.id, (flips.get(r.id) ?? new Set()).add(r.e2.settled ? r.e2.verdict : `fall:${r.e2.via}`));
    const unstable = [...flips].filter(([, v]) => v.size > 1).map(([id]) => id);
    say(`| jev + rules (settled only) | ${settled.length} of ${js.length} settled | **${fs.length}**${fs.length ? ` (${fs.map((r) => r.id).join(", ")})` : ""} | ${fu.length} settled unsafe on a safe case | – |`);
    say();
    say(`E2 on D1: ${settled.filter((r) => r.e2.verdict === "safe").length} settled safe, ${settled.filter((r) => r.e2.verdict === "unsafe").length} settled unsafe; cases whose E2 outcome changed between runs: ${unstable.length ? unstable.join(", ") : "none"}.`);
    for (const r of [...fs, ...fu]) review.push({ why: "E2 settled against the case's expectation", ...r });
  }
} else {
  say("## D2: real Open Food Facts records");
  const opus0 = rows.opus.filter((r) => r.verdict);
  const records = new Map(readJsonl<any>(`${dir}/data/public/records.jsonl`).map((r) => [r.id, r]));
  const listed = (id: string) => glutenWords(records.get(id)?.product?.ingredients_text ?? "").length > 0;
  const slices: [string, (r: any) => boolean][] = [["all", () => true], ["English only", (r) => r.group === "en"]];
  for (const [slice, keep] of slices) {
    say();
    say(`### ${slice}`);
    say();
    say("| Engine | Records | safe | caution | unsafe | Agrees with Opus | Safe where Opus isn't | Safe on a label listing gluten |");
    say("| --- | --- | --- | --- | --- | --- | --- | --- |");
    const base = opus0.filter(keep);
    const dist = (vs: string[]) => ["safe", "caution", "unsafe"].map((v) => pct(vs.filter((x) => x === v).length, vs.length));
    say(`| opus | ${base.length} | ${dist(base.map((r) => r.verdict)).join(" | ")} | – | – | ${base.filter((r) => r.verdict === "safe" && listed(r.id)).length} |`);
    const hs = rows.haiku.filter((r) => r.verdict && keep(r) && opusBy.get(r.key)?.verdict);
    if (hs.length) {
      const agree = hs.filter((r) => r.verdict === opusBy.get(r.key).verdict).length;
      const safer = hs.filter((r) => r.verdict === "safe" && opusBy.get(r.key).verdict !== "safe");
      const onListed = hs.filter((r) => r.verdict === "safe" && listed(r.id));
      say(`| haiku | ${hs.length} | ${dist(hs.map((r) => r.verdict)).join(" | ")} | ${pct(agree, hs.length)} | ${safer.length} | ${onListed.length} |`);
      if (slice === "all") for (const r of [...safer, ...onListed]) review.push({ why: "haiku safe where opus isn't, or on a listed-gluten label", opus: opusBy.get(r.key)?.verdict, ...r, ingredients: records.get(r.id)?.product?.ingredients_text });
    }
    const js = rows.jev.filter((r) => r.e2 && keep(r) && opusBy.get(r.key)?.verdict);
    if (js.length) {
      const comp = js.map((j) => composite(j, opusBy));
      const agree = js.filter((j, i) => comp[i] === opusBy.get(j.key).verdict).length;
      const safer = js.filter((j) => j.e2.settled && j.e2.verdict === "safe" && opusBy.get(j.key).verdict !== "safe");
      const onListed = js.filter((j) => j.e2.settled && j.e2.verdict === "safe" && listed(j.id));
      say(`| jev + rules → opus | ${js.length} | ${dist(comp).join(" | ")} | ${pct(agree, js.length)} | ${safer.length} | ${onListed.length} |`);
      if (slice === "all") {
        for (const r of [...safer, ...onListed]) review.push({ why: "E2 settled safe where opus isn't, or on a listed-gluten label", opus: opusBy.get(r.key)?.verdict, ...r, ingredients: records.get(r.id)?.product?.ingredients_text });
        const falseUnsafe = js.filter((j) => j.e2.settled && j.e2.verdict === "unsafe" && opusBy.get(j.key).verdict !== "unsafe");
        for (const r of falseUnsafe) review.push({ why: "E2 settled unsafe where opus didn't", opus: opusBy.get(r.key)?.verdict, ...r, ingredients: records.get(r.id)?.product?.ingredients_text });
        const via = new Map<string, number>();
        for (const j of js) via.set(j.e2.via, (via.get(j.e2.via) ?? 0) + 1);
        say();
        say(`E2 coverage (settled without Claude): **${pct(js.filter((j) => j.e2.settled).length, js.length)}**. Settled unsafe where Opus didn't: ${falseUnsafe.length}. By branch: ${[...via].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}.`);
      }
    }
  }
}
say();
say(`## Latency and cost (${set})`);
say();
latencyTable();
console.log(out.join("\n"));
writeFileSync(`${dir}/raw/review-${set}.jsonl`, review.map((r) => JSON.stringify(r)).join("\n") + (review.length ? "\n" : ""));
console.error(`${review.length} rows to review → raw/review-${set}.jsonl`);
