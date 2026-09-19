import type { Questions, SystemOneResult } from "@typesafe-ai/sdk";
import { MODEL, makeClient } from "./client.ts";
import { existsSync, readFileSync } from "node:fs";
import { datasetPath, readJsonl, writeJsonl, type Item, type RunRecord } from "./items.ts";
import { formatSummary, summarize } from "./score.ts";

export interface Experiment<S, Q extends Questions> {
  /** Absolute path of the experiment folder (use import.meta.dirname). */
  dir: string;
  questions: Q;
  /** Questions used with `--context`; they should point the model at `recipient`. Defaults to `questions`. */
  questionsWithContext?: Q;
  /** Collapse Jev's answers into the single label compared against `expected`. */
  predict: (
    answers: SystemOneResult<Q>["answers"],
    state: S,
  ) => { label: string; confidence?: number; score?: number };
  /** Class whose `score` is ranked for AUC, if predict returns scores. */
  positive?: string;
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

/** Run every item through Jev one call at a time, write raw/ records, print aggregates. */
export async function runExperiment<S, Q extends Questions>(exp: Experiment<S, Q>): Promise<void> {
  const { dir: datasetDir, path, real } = datasetPath(exp.dataDir ?? exp.dir, process.argv);
  const items = readJsonl<Item<S>>(path);
  const recipient = loadContext(datasetDir, process.argv);
  const client = makeClient();
  console.error(
    `${items.length} items from ${real ? "REAL data" : "fixtures"}${recipient ? " + recipient context" : ""}: ${path}`,
  );

  const records: RunRecord[] = [];
  for (const item of items) {
    const started = performance.now();
    // Sibling key, so questions reference the item's fields the same way in both variants.
    const state = recipient === undefined ? item.state : { ...item.state, recipient };
    const questions = recipient === undefined ? exp.questions : (exp.questionsWithContext ?? exp.questions);
    const res = await client.systemOne({ model: MODEL, state: state as never, questions });
    const latencyMs = performance.now() - started;
    const { label, confidence, score } = exp.predict(res.answers, item.state);
    records.push({
      id: item.id,
      expected: item.expected,
      predicted: label,
      confidence,
      score,
      latencyMs,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      model: res.model,
      answers: res.answers,
    });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = `${exp.dir}/raw/${real ? "real" : "fixtures"}${recipient ? "-context" : ""}-${stamp}.jsonl`;
  writeJsonl(out, records);
  console.error(`raw records: ${out} (gitignored)`);
  console.log(formatSummary(summarize(records, undefined, exp.positive)));
}
