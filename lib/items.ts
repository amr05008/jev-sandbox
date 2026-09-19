import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** One thing to judge. `expected` is the label we compare Jev's answer against. */
export interface Item<S = unknown> {
  id: string;
  state: S;
  expected?: string;
  /** Optional slice to break results down by, such as a language. */
  group?: string;
}

/** One judged item, written to raw/ (gitignored: it echoes the item's state). */
export interface RunRecord {
  id: string;
  group?: string;
  expected?: string;
  predicted: string;
  confidence?: number;
  /** Optional ranking score for the experiment's positive class, for AUC. */
  score?: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  answers: unknown;
}

export function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        throw new Error(`${path}:${i + 1} is not valid JSON`);
      }
    });
}

export function writeJsonl(path: string, rows: readonly unknown[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

/**
 * Pick the dataset from argv. Defaults to fixtures so a bare run, or a run on
 * camera, never touches real data. `--real` is private and gitignored;
 * `--public` is a committed dataset built from an openly licensed source.
 */
export function datasetPath(experimentDir: string, argv: readonly string[]): {
  dir: string;
  path: string;
  name: "real" | "public" | "fixtures";
} {
  const name = argv.includes("--real") ? "real" : argv.includes("--public") ? "public" : "fixtures";
  const dir = `${experimentDir}/data/${name}`;
  return { dir, path: `${dir}/items.jsonl`, name };
}
