import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { makeClient } from "../../lib/client.ts";
import { readJsonl } from "../../lib/items.ts";
import { CLAUDE_MODELS, EST_PER_CALL, askClaude, askJev, e2Rule, type ClaudeEngine } from "./engines.ts";
import { loadScanner, type Product } from "./scanner.ts";

// The bake-off runner. Without --confirm it prints the plan and a cost estimate
// and exits: nothing is spent. Results append to raw/<engine>-<set>.jsonl as
// they arrive, so a re-run resumes instead of re-spending.
//
// node --env-file=.env experiments/07-barcode-bakeoff/run.ts --scanner=/path/to/checkout --set=d1|d2
//      [--engines=opus,haiku,jev] [--limit=N] [--concurrency=4] [--confirm]

const flag = (name: string, fallback?: string): string => {
  const v = process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  if (v === undefined) throw new Error(`--${name}= is required`);
  return v;
};
const has = (name: string) => process.argv.includes(`--${name}`);
const MAX_CLAUDE_CALLS = 2500; // per invocation; the full plan is ~2,250

const s = loadScanner(flag("scanner"));
const set = flag("set");
const engines = flag("engines", "opus,haiku,jev").split(",");
const limit = Number(flag("limit", String(Number.MAX_SAFE_INTEGER)));
const concurrency = Number(flag("concurrency", "4"));
const dir = import.meta.dirname;
if (s.dirty && !has("allow-dirty")) {
  throw new Error("the scanner checkout has uncommitted changes under api/ or the evals; commit them so the run is pinned to a commit");
}
for (const e of engines) if (!(e in CLAUDE_MODELS) && e !== "jev") throw new Error(`unknown engine ${e}`);

interface Item {
  id: string;
  product: Product;
  group: string | null;
  expect?: string;
  reason?: string;
  samples: { claude: number; jev: number };
}

function loadItems(): Item[] {
  if (set === "d1") {
    // The scanner's merge-gate sampling: 2× for cases expected safe, 5× for the rest.
    return s.evalCases.map((c) => ({
      id: c.id, product: c.product, group: "d1", expect: c.expect, reason: c.reason,
      samples: { claude: c.expect === "safe" ? 2 : 5, jev: 2 },
    }));
  }
  if (set === "d2") {
    const path = `${dir}/data/public/records.jsonl`;
    if (!existsSync(path)) throw new Error("run fetch-records.ts first");
    return readJsonl<any>(path)
      .filter((r) => r.product)
      .map((r) => ({ id: r.id, product: r.product, group: r.group, samples: { claude: 1, jev: 1 } }));
  }
  throw new Error("--set must be d1 or d2");
}

const items = loadItems().slice(0, limit);
mkdirSync(`${dir}/raw`, { recursive: true });
const outFor = (engine: string) => `${dir}/raw/${engine}-${set}.jsonl`; // fixed name: re-running resumes
const plan = engines.map((engine) => {
  const out = outFor(engine);
  const done = new Set(existsSync(out) ? readJsonl<{ key: string }>(out).map((r) => r.key) : []);
  const tasks = items.flatMap((item) =>
    Array.from({ length: engine === "jev" ? item.samples.jev : item.samples.claude }, (_, k) => ({ item, k, key: `${item.id}#${k}` })),
  ).filter((t) => !done.has(t.key));
  return { engine, out, tasks, done: done.size, estimate: tasks.length * EST_PER_CALL[engine as ClaudeEngine | "jev"] };
});

const claudeCalls = plan.filter((p) => p.engine !== "jev").reduce((n, p) => n + p.tasks.length, 0);
console.error(`set ${set}: ${items.length} items | scanner @ ${s.commit} | concurrency ${concurrency}`);
for (const p of plan) console.error(`  ${p.engine.padEnd(6)} ${String(p.tasks.length).padStart(5)} calls to run (${p.done} done)  ~$${p.estimate.toFixed(2)}`);
console.error(`  total  ~$${plan.reduce((n, p) => n + p.estimate, 0).toFixed(2)} (Anthropic list prices; Jev at the cookbook rate)`);
if (claudeCalls > MAX_CLAUDE_CALLS) throw new Error(`refusing: ${claudeCalls} Claude calls exceeds the ${MAX_CLAUDE_CALLS} cap`);
if (!has("confirm")) {
  console.error("dry run: nothing spent. Add --confirm to run.");
  process.exit(0);
}

async function pool<T>(xs: T[], n: number, fn: (x: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => {
    while (next < xs.length) await fn(xs[next++]!);
  }));
}

const jev = engines.includes("jev") ? makeClient() : null;
const started = new Date().toISOString();
// One engine at a time, so engines never compete for the network while timed.
for (const p of plan) {
  if (p.tasks.length === 0) continue;
  let spent = 0;
  let n = 0;
  const run = async ({ item, k, key }: (typeof p.tasks)[number], warm = false) => {
    const base = { key, id: item.id, k, set, group: item.group, expect: item.expect ?? null, reason: item.reason ?? null, engine: p.engine, scanner_commit: s.commit, run_started: started, warm };
    if (p.engine === "jev") {
      const r = await askJev(jev!, item.product);
      const e2 = e2Rule(item.product, "nouls" in r ? r.nouls! : null, s);
      appendFileSync(p.out, JSON.stringify({ ...base, ...r, e2 }) + "\n");
    } else {
      const r = await askClaude(p.engine as ClaudeEngine, item.product, s);
      appendFileSync(p.out, JSON.stringify({ ...base, ...r }) + "\n");
      if ("cost" in r) spent += r.cost ?? 0;
    }
    if (++n % 50 === 0) console.error(`  ${p.engine} ${n}/${p.tasks.length}  ~$${spent.toFixed(2)} spent`);
  };
  // The first call runs alone so the prompt cache is written before the pool starts; it's flagged warm and left out of latency stats.
  await run(p.tasks[0]!, true);
  await pool(p.tasks.slice(1), concurrency, (t) => run(t));
  console.error(`${p.engine}: ${p.tasks.length} calls, ~$${spent.toFixed(2)} spent → ${p.out}`);
}
