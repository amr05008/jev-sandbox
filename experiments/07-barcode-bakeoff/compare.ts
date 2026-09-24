import { existsSync, writeFileSync } from "node:fs";
import { readJsonl } from "../../lib/items.ts";
import { glutenWords } from "../03-gluten-labels/keywords.ts";
import { stratifiedOrder } from "./order.ts";

// Scores the bake-off from raw/. Prints aggregate tables (safe to publish) and
// writes the rows that need a human look to raw/review-<set>[-<split>].jsonl
// (gitignored).
//
// node experiments/07-barcode-bakeoff/compare.ts --set=d1
// node experiments/07-barcode-bakeoff/compare.ts --set=d2 [--split=all|dev|test]
//   dev = D2 items 1–200 of the stratified order (tuning), test = 201–996 (the grade).

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const set = arg("set", "d2");
const split = arg("split", "all");
const DEV_SIZE = 200;
const dir = import.meta.dirname;

const records = new Map(readJsonl<any>(`${dir}/data/public/records.jsonl`).map((r) => [r.id, r]));
const rank = new Map(stratifiedOrder([...records.values()].filter((r) => r.product)).map((r, i) => [r.id, i]));
const inSplit = (r: any) =>
  set !== "d2" || split === "all" || (split === "dev" ? (rank.get(r.id) ?? 1e9) < DEV_SIZE : (rank.get(r.id) ?? -1) >= DEV_SIZE);
const load = (engine: string) => {
  const path = `${dir}/raw/${engine}-${set}.jsonl`;
  return existsSync(path) ? readJsonl<any>(path).filter(inSplit) : [];
};
const claude = { opus: load("opus"), haiku: load("haiku") };
const jevEngines = ["jev", "jev-v2"].map((name) => ({ name, rows: load(name) })).filter((j) => j.rows.length);
const byKey = (rs: any[]) => new Map(rs.map((r) => [r.key, r]));
const opusBy = byKey(claude.opus);
const haikuBy = byKey(claude.haiku);

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "–");
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN;
};
const secs = (ms: number) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(2)} s` : "–");
const review: any[] = [];
const out: string[] = [];
const say = (line = "") => out.push(line);
const ingredients = (id: string) => records.get(id)?.product?.ingredients_text;

/** A settled E2 verdict, else the Claude engine's verdict for the same key: the composite a fast path would show. */
const composite = (j: any, fallback: Map<string, any>) => (j.e2?.settled ? j.e2.verdict : fallback.get(j.key)?.verdict);

function latencyTable() {
  say("| Engine | Calls | Latency p50 | p95 | Output tokens p50 | Cost per 1,000 |");
  say("| --- | --- | --- | --- | --- | --- |");
  for (const engine of ["opus", "haiku"] as const) {
    const rs = claude[engine].filter((r) => !r.warm && r.latencyMs);
    if (!rs.length) continue;
    const cost = rs.reduce((n, r) => n + (r.cost ?? 0), 0) / rs.length;
    say(`| ${engine} | ${rs.length} | ${secs(q(rs.map((r) => r.latencyMs), 0.5))} | ${secs(q(rs.map((r) => r.latencyMs), 0.95))} | ${q(rs.map((r) => r.usage?.output_tokens ?? 0), 0.5)} | $${(cost * 1000).toFixed(2)} |`);
  }
  const notes: string[] = [];
  for (const { name, rows } of jevEngines) {
    const js = rows.filter((r) => !r.warm && r.nouls);
    if (!js.length) continue;
    say(`| ${name} (alone) | ${js.length} | ${secs(q(js.map((r) => r.latencyMs), 0.5))} | ${secs(q(js.map((r) => r.latencyMs), 0.95))} | – | ~$0.05 |`);
    for (const [fbName, fb] of [["opus", opusBy], ["haiku", haikuBy]] as const) {
      // Only when that engine answered every record E2 passed on; otherwise the row would be settled-only and look fast.
      if (!js.every((j) => j.e2.settled || fb.get(j.key)?.latencyMs)) continue;
      const comp = js.map((j) => j.latencyMs + (j.e2.settled ? 0 : fb.get(j.key).latencyMs));
      say(`| ${name} + rules, falling through to ${fbName} | ${comp.length} | ${secs(q(comp, 0.5))} | ${secs(q(comp, 0.95))} | – | – |`);
    }
    const over800 = js.filter((r) => r.latencyMs > 800).length;
    notes.push(`${name}: ${rows.filter((r) => r.error).length} errors, ${over800} of ${js.length} calls over an 800 ms production timeout (${pct(over800, js.length)}).`);
  }
  if (notes.length) {
    say();
    for (const n of notes) say(n);
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
    const rs = claude[engine].filter((r) => r.verdict);
    if (!rs.length) continue;
    const fs = rs.filter((r) => r.expect !== "safe" && r.verdict === "safe");
    const over = rs.filter((r) => r.expect === "safe" && r.verdict !== "safe");
    const cases = new Map<string, boolean>();
    for (const r of rs) cases.set(r.id, (cases.get(r.id) ?? true) && passes(r));
    const failing = [...cases].filter(([, ok]) => !ok).map(([id]) => id);
    say(`| ${engine} | ${rs.length} | **${fs.length}**${fs.length ? ` (${[...new Set(fs.map((r) => r.id))].join(", ")})` : ""} | ${over.length} | ${cases.size - failing.length}/${cases.size}${failing.length ? ` (failing: ${failing.join(", ")})` : ""} |`);
    for (const r of rs.filter((r) => !passes(r))) review.push({ why: `${engine} misses its expectation`, ...r });
  }
  const lines: string[] = [];
  for (const { name, rows } of jevEngines) {
    const js = rows.filter((r) => r.e2);
    const settled = js.filter((r) => r.e2.settled);
    const fs = settled.filter((r) => r.expect !== "safe" && r.e2.verdict === "safe");
    const fu = settled.filter((r) => r.expect === "safe" && r.e2.verdict === "unsafe");
    const flips = new Map<string, Set<string>>();
    for (const r of js) flips.set(r.id, (flips.get(r.id) ?? new Set()).add(r.e2.settled ? r.e2.verdict : `fall:${r.e2.via}`));
    const unstable = [...flips].filter(([, v]) => v.size > 1).map(([id]) => id);
    say(`| ${name} + rules (settled only) | ${settled.length} of ${js.length} settled | **${fs.length}**${fs.length ? ` (${fs.map((r) => r.id).join(", ")})` : ""} | ${fu.length} settled unsafe on a safe case | – |`);
    lines.push(`${name} on D1: ${settled.filter((r) => r.e2.verdict === "safe").length} settled safe, ${settled.filter((r) => r.e2.verdict === "unsafe").length} settled unsafe; cases whose outcome changed between runs: ${unstable.length ? unstable.join(", ") : "none"}.`);
    for (const r of [...fs, ...fu]) review.push({ why: `${name} settled against the case's expectation`, ...r });
  }
  if (lines.length) {
    say();
    for (const l of lines) say(l);
  }
} else {
  const label = split === "dev" ? ` (dev: items 1–${DEV_SIZE})` : split === "test" ? ` (test: items ${DEV_SIZE + 1}+)` : "";
  say(`## D2: real Open Food Facts records${label}`);
  const listed = (id: string) => glutenWords(ingredients(id) ?? "").length > 0;
  const slices: [string, (r: any) => boolean][] = [["all", () => true], ["English only", (r) => r.group === "en"]];
  const dist = (vs: string[]) => ["safe", "caution", "unsafe"].map((v) => pct(vs.filter((x) => x === v).length, vs.length));
  for (const [slice, keep] of slices) {
    say();
    say(`### ${slice}`);
    say();
    say("| Engine | Records | safe | caution | unsafe | Agrees with Opus | Safe where Opus isn't | Safe on a label listing gluten |");
    say("| --- | --- | --- | --- | --- | --- | --- | --- |");
    const base = claude.opus.filter((r) => r.verdict && keep(r));
    say(`| opus | ${base.length} | ${dist(base.map((r) => r.verdict)).join(" | ")} | – | – | ${base.filter((r) => r.verdict === "safe" && listed(r.id)).length} |`);
    const hs = claude.haiku.filter((r) => r.verdict && keep(r) && opusBy.get(r.key)?.verdict);
    if (hs.length) {
      const agree = hs.filter((r) => r.verdict === opusBy.get(r.key).verdict).length;
      const safer = hs.filter((r) => r.verdict === "safe" && opusBy.get(r.key).verdict !== "safe");
      const onListed = hs.filter((r) => r.verdict === "safe" && listed(r.id));
      say(`| haiku | ${hs.length} | ${dist(hs.map((r) => r.verdict)).join(" | ")} | ${pct(agree, hs.length)} | ${safer.length} | ${onListed.length} |`);
      if (slice === "all") for (const r of [...safer, ...onListed]) review.push({ why: "haiku safe where opus isn't, or on a listed-gluten label", opus: opusBy.get(r.key)?.verdict, ...r, ingredients: ingredients(r.id) });
    }
    const coverage: string[] = [];
    for (const { name, rows } of jevEngines) {
      const js = rows.filter((r) => r.e2 && keep(r) && opusBy.get(r.key)?.verdict);
      if (!js.length) continue;
      const comp = js.map((j) => composite(j, opusBy));
      const agree = js.filter((j, i) => comp[i] === opusBy.get(j.key).verdict).length;
      const safer = js.filter((j) => j.e2.settled && j.e2.verdict === "safe" && opusBy.get(j.key).verdict !== "safe");
      const onListed = js.filter((j) => j.e2.settled && j.e2.verdict === "safe" && listed(j.id));
      say(`| ${name} + rules → opus | ${js.length} | ${dist(comp).join(" | ")} | ${pct(agree, js.length)} | ${safer.length} | ${onListed.length} |`);
      if (slice === "all") {
        const falseUnsafe = js.filter((j) => j.e2.settled && j.e2.verdict === "unsafe" && opusBy.get(j.key).verdict !== "unsafe");
        for (const r of [...safer, ...onListed]) review.push({ why: `${name} settled safe where opus isn't, or on a listed-gluten label`, opus: opusBy.get(r.key), ...r, ingredients: ingredients(r.id) });
        for (const r of falseUnsafe) review.push({ why: `${name} settled unsafe where opus didn't`, opus: opusBy.get(r.key), ...r, ingredients: ingredients(r.id) });
        const via = new Map<string, number>();
        for (const j of js) via.set(j.e2.via, (via.get(j.e2.via) ?? 0) + 1);
        coverage.push(`${name}: settled without Claude **${pct(js.filter((j) => j.e2.settled).length, js.length)}**; settled unsafe where Opus didn't: ${falseUnsafe.length}. By branch: ${[...via].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}.`);
      }
    }
    if (coverage.length) {
      say();
      for (const c of coverage) say(c);
    }
  }
}
say();
say(`## Latency and cost (${set}${set === "d2" && split !== "all" ? `, ${split}` : ""})`);
say();
latencyTable();
console.log(out.join("\n"));
const reviewPath = `${dir}/raw/review-${set}${set === "d2" && split !== "all" ? `-${split}` : ""}.jsonl`;
writeFileSync(reviewPath, review.map((r) => JSON.stringify(r)).join("\n") + (review.length ? "\n" : ""));
console.error(`${review.length} rows to review → ${reviewPath}`);
