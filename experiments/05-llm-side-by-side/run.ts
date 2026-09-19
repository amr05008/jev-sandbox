import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readJsonl, type Item } from "../../lib/items.ts";
import type { State } from "../03-gluten-labels/questions.ts";

// Runs an open-source label scanner's production LLM request over the same
// labels Jev saw, so the two can be compared item by item.
//
// The request is rebuilt exactly as the scanner sends it (raw fetch, its own
// prompt constant, its model, its max_tokens, its cache marker) rather than
// through an SDK, because reproducing production byte for byte is the point.
// The prompt is imported from a local checkout at run time, not copied here.
//
// node --env-file=.env experiments/05-llm-side-by-side/run.ts --scanner=/path/to/checkout [--set=clean|cuts] [--concurrency=4]

const arg = (name: string, fallback?: string): string => {
  const v = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
  if (v === undefined) throw new Error(`--${name}= is required`);
  return v;
};
const scanner = arg("scanner");
const set = arg("set", "clean");
const concurrency = Number(arg("concurrency", "4"));
const dir = import.meta.dirname;

const require = createRequire(import.meta.url);
const { CLAUDE_PROMPT, parseClaudeResponse } = require(`${scanner}/api/analyze.js`);
const commit = execFileSync("git", ["-C", scanner, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const MODEL = "claude-opus-4-8"; // the scanner's CLAUDE_MODEL at that commit
const MAX_TOKENS = 4096;

// mulberry32, for a seeded sample.
let seed = 20260918;
const random = (): number => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Row = Item<State> & { group: string; meta?: { variant?: string } };
function pick(): Row[] {
  if (set === "clean") {
    // 1,000 of experiment 03's 3,300, keeping its language × class proportions.
    const all = readJsonl<Row>(`${dir}/../03-gluten-labels/data/public/items.jsonl`);
    const strata = new Map<string, Row[]>();
    for (const i of all) strata.set(`${i.group}/${i.expected}`, [...(strata.get(`${i.group}/${i.expected}`) ?? []), i]);
    return [...strata.keys()].sort().flatMap((k) => {
      const rows = strata.get(k)!;
      const shuffled = rows.map((r) => [random(), r] as const).sort((a, b) => a[0] - b[0]).map(([, r]) => r);
      return shuffled.slice(0, Math.round((rows.length * 1000) / all.length));
    });
  }
  // Experiment 04's gluten labels with the end or the start cut off.
  return readJsonl<Row>(`${dir}/../04-ocr-noise/data/public/items.jsonl`).filter(
    (i) => i.expected === "unsafe" && ["cut-end-50", "cut-start-50"].includes(i.meta?.variant ?? ""),
  );
}

const sample = pick();
mkdirSync(`${dir}/raw`, { recursive: true });
writeFileSync(`${dir}/data/public/sample-${set}.json`, JSON.stringify(sample.map((i) => i.id)));
const out = `${dir}/raw/claude-${set}.jsonl`; // fixed name: re-running resumes instead of re-spending
const done = new Set(existsSync(out) ? readJsonl<{ id: string }>(out).map((r) => r.id) : []);
const todo = sample.filter((i) => !done.has(i.id));
console.error(`${set}: ${sample.length} labels, ${done.size} already done, ${todo.length} to run | scanner @ ${commit} | ${MODEL}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function ask(text: string): Promise<{ data: any; latencyMs: number }> {
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: [
          { type: "text", text: CLAUDE_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: `### OCR Text:\n${text}` },
        ] }],
      }),
      signal: AbortSignal.timeout(60_000),
    }).catch(() => null);
    if (res?.ok) return { data: await res.json(), latencyMs: performance.now() - started };
    // 4xx other than 429 will not fix itself: stop rather than burn the budget.
    if (res && res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    if (attempt >= 6) throw new Error(`gave up after ${attempt + 1} attempts (last status ${res?.status ?? "network"})`);
    await sleep(Math.min(60_000, Number(res?.headers.get("retry-after") ?? 0) * 1000 || 2000 * 2 ** attempt));
  }
}

let next = 0;
let spentIn = 0, spentOut = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < todo.length) {
      const item = todo[next++]!;
      const { data, latencyMs } = await ask(item.state.ingredients);
      const text: string = data.content?.find((b: any) => b.type === "text")?.text ?? "";
      let parsed: any = null;
      try { parsed = parseClaudeResponse(text); } catch { /* keep the raw text; analysis decides */ }
      appendFileSync(out, JSON.stringify({
        id: item.id, group: item.group, expected: item.expected,
        verdict: parsed?.verdict ?? null, confidence: parsed?.confidence ?? null,
        latencyMs, usage: data.usage, stop_reason: data.stop_reason, scanner_commit: commit, model: data.model, text,
      }) + "\n");
      spentIn += data.usage.input_tokens + data.usage.cache_read_input_tokens * 0.1 + data.usage.cache_creation_input_tokens * 1.25;
      spentOut += data.usage.output_tokens;
      const n = done.size + next;
      if (next % 50 === 0) console.error(`${n}/${sample.length}  ~$${((spentIn * 5 + spentOut * 25) / 1e6).toFixed(2)} this run`);
    }
  }),
);
console.error(`finished ${set}: ~$${((spentIn * 5 + spentOut * 25) / 1e6).toFixed(2)} this run → ${out}`);
