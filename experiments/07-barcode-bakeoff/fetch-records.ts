import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { readJsonl } from "../../lib/items.ts";
import { loadScanner } from "./scanner.ts";

// D2: re-fetch experiment 05's 996 Open Food Facts products by barcode through
// the scanner's own lookup, so each record carries the tags its barcode path
// sends (allergens, traces, labels). Public ODbL data; resumable; one product
// every 2 s, because 1/s drew 429s on 2026-09-24. No API keys needed.
//
// node experiments/07-barcode-bakeoff/fetch-records.ts --scanner=/path/to/checkout [--limit=N]

const flag = (name: string, fallback?: string): string => {
  const v = process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  if (v === undefined) throw new Error(`--${name}= is required`);
  return v;
};
const s = loadScanner(flag("scanner"));
const limit = Number(flag("limit", String(Number.MAX_SAFE_INTEGER)));
const dir = import.meta.dirname;

const ids: string[] = JSON.parse(readFileSync(`${dir}/../05-llm-side-by-side/data/public/sample-clean.json`, "utf8"));
const meta = new Map(readJsonl<any>(`${dir}/../03-gluten-labels/data/public/items.jsonl`).map((i) => [i.id, i]));
mkdirSync(`${dir}/data/public`, { recursive: true });
if (!existsSync(`${dir}/data/public/LICENSE.md`)) {
  copyFileSync(`${dir}/../03-gluten-labels/data/public/LICENSE.md`, `${dir}/data/public/LICENSE.md`);
}
const out = `${dir}/data/public/records.jsonl`;
const done = new Set(existsSync(out) ? readJsonl<{ id: string }>(out).map((r) => r.id) : []);
const todo = ids.filter((id) => !done.has(id)).slice(0, limit);
console.error(`${ids.length} products, ${done.size} already fetched, ${todo.length} to fetch`);

// The scanner's lookup reads a 429 as "not found", which would record a
// rate-limited product as gone. Retry 429s underneath it (with a fresh timeout,
// since the scanner's 5 s signal will have expired), and stop the run rather
// than write a null if the limit persists. A re-run resumes.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const realFetch = globalThis.fetch;
let rateLimited = false;
globalThis.fetch = async (input: any, init?: any) => {
  for (let attempt = 0; ; attempt++) {
    const res = await realFetch(input, attempt ? { ...init, signal: AbortSignal.timeout(5000) } : init);
    if (res.status !== 429) return res;
    if (attempt >= 5) {
      rateLimited = true;
      return res;
    }
    const wait = Number(res.headers.get("retry-after") ?? 0) * 1000 || 10_000 * 2 ** attempt;
    console.error(`Open Food Facts 429; waiting ${wait / 1000} s`);
    await sleep(wait);
  }
};

const quiet = console.log; // the scanner's lookup logs each hit to stdout
console.log = () => {};
let found = 0;
let missing = 0;
for (const [n, id] of todo.entries()) {
  const product = await s.lookupOpenFoodFacts(id.replace(/^off-/, ""));
  if (rateLimited) {
    console.error(`stopping: Open Food Facts kept rate-limiting (${n} fetched this run). Re-run later to resume.`);
    process.exit(1);
  }
  const m = meta.get(id);
  appendFileSync(out, JSON.stringify({ id, group: m?.group ?? null, expected03: m?.expected ?? null, product }) + "\n");
  if (product) found++;
  else missing++;
  if ((n + 1) % 50 === 0) console.error(`${n + 1}/${todo.length}  found ${found}, gone ${missing}`);
  await sleep(2000);
}
console.log = quiet;
console.error(`done: found ${found}, no longer in Open Food Facts ${missing} → ${out}`);
