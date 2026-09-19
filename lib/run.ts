import type { Questions, SystemOneResult } from "@typesafe-ai/sdk";
import { MODEL, makeClient } from "./client.ts";
import { existsSync, readFileSync } from "node:fs";
import { datasetPath, readJsonl, writeJsonl, type Item, type RunRecord } from "./items.ts";
import { formatSummary, summarize, type ScoreOptions } from "./score.ts";

export type Predict<S, Q extends Questions> = (
  answers: SystemOneResult<Q>["answers"],
  state: S,
) => { label: string; confidence?: number; score?: number };

export interface Experiment<S, Q extends Questions> extends ScoreOptions {
  /** Absolute path of the experiment folder (use import.meta.dirname). */
  dir: string;
  questions: Q;
  /** Questions used with `--context`; they should point the model at `recipient`. Defaults to `questions`. */
  questionsWithContext?: Q;
  /**
   * Collapse Jev's answers into the single label compared against `expected`.
   * Pass a record to score several ways of reading the same answers ("heads")
   * from one call: questions are evaluated in isolation, so asking them
   * together does not change any of them.
   */
  predict: Predict<S, Q> | Record<string, Predict<S, Q>>;
  /** Where the items live, when an experiment reuses another's dataset. Defaults to `dir`. */
  dataDir?: string;
}

/**
 * `--context` adds the dataset's `recipient.json` to every item's state as
 * `recipient`. The real one is gitignored like the rest of data/real/; the
 * fixtures one is a synthetic persona.
 */
function loadContext(datasetDir: string, argv: readonly string[]): unknown | undefined {
  if (!argv.includes("--context")) return undefined;
  const path = `${datasetDir}/recipient.json`;
  if (!existsSync(path)) throw new Error(`--context needs ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

const numberFlag = (argv: readonly string[], name: string, fallback: number): number => {
  const raw = argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const n = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer`);
  return n;
};

/** Run `worker` over `inputs` with at most `limit` in flight, keeping input order. */
async function pool<T, R>(inputs: readonly T[], limit: number, worker: (input: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(inputs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, inputs.length) }, async () => {
      while (next < inputs.length) {
        const i = next++;
        out[i] = await worker(inputs[i]!, i);
      }
    }),
  );
  return out;
}

/** Run every item through Jev, write raw/ records, print aggregates per head. */
export async function runExperiment<S, Q extends Questions>(exp: Experiment<S, Q>): Promise<void> {
  const { dir: datasetDir, path, name } = datasetPath(exp.dataDir ?? exp.dir, process.argv);
  const limit = numberFlag(process.argv, "limit", Number.MAX_SAFE_INTEGER);
  const concurrency = numberFlag(process.argv, "concurrency", 4);
  const items = readJsonl<Item<S>>(path).slice(0, limit);
  const recipient = loadContext(datasetDir, process.argv);
  const client = makeClient();
  console.error(
    `${items.length} items from ${name === "real" ? "REAL data" : name}${recipient ? " + recipient context" : ""}: ${path}`,
  );

  const heads = typeof exp.predict === "function" ? { default: exp.predict } : exp.predict;
  const questions = recipient === undefined ? exp.questions : (exp.questionsWithContext ?? exp.questions);

  const answered = await pool(items, concurrency, async (item) => {
    const started = performance.now();
    // Sibling key, so questions reference the item's fields the same way in both variants.
    const state = recipient === undefined ? item.state : { ...item.state, recipient };
    const res = await client.systemOne({ model: MODEL, state: state as never, questions });
    return { item, res, latencyMs: performance.now() - started };
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const [head, predict] of Object.entries(heads)) {
    const records: RunRecord[] = answered.map(({ item, res, latencyMs }) => {
      const { label, confidence, score } = predict(res.answers, item.state);
      return {
        id: item.id,
        group: item.group,
        expected: item.expected,
        predicted: label,
        confidence,
        score,
        latencyMs,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        model: res.model,
        answers: res.answers,
      };
    });
    const suffix = `${name}${recipient ? "-context" : ""}${head === "default" ? "" : `-${head}`}`;
    const out = `${exp.dir}/raw/${suffix}-${stamp}.jsonl`;
    writeJsonl(out, records);
    console.error(`raw records: ${out} (gitignored)`);
    if (head !== "default") console.log(`\n## head: ${head}\n`);
    console.log(formatSummary(summarize(records, exp)));
  }
}
