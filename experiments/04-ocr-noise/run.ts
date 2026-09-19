import { runExperiment, type Predict } from "../../lib/run.ts";
import type { State } from "../03-gluten-labels/questions.ts";
import { CLEAR_BELOW, COMPLETE_AT, SOURCE_AT, SOURCES, questions } from "./questions.ts";

// node --env-file=.env experiments/04-ocr-noise/run.ts --public --concurrency=8
type P = Predict<State, typeof questions>;

// Experiment 03's code rule, reading the text as given.
const ungated: P = (a) => {
  const source = Math.max(...SOURCES.map((k) => a[k].noul));
  const danger = Math.max(source, a.may_contain.noul);
  if (source >= SOURCE_AT) return { label: "unsafe", confidence: source };
  if (a.may_contain.noul >= SOURCE_AT) return { label: "caution", confidence: a.may_contain.noul };
  if (danger < CLEAR_BELOW) return { label: "safe", confidence: 1 - danger };
  return { label: "uncertain", confidence: 1 - danger };
};

// Same rule, but `safe` is only allowed on text that looks complete. Finding
// gluten in a damaged list is still trustworthy; failing to find it is not.
const gated: P = (a, state) => {
  const verdict = ungated(a, state);
  if (verdict.label === "safe" && a.complete.noul < COMPLETE_AT) return { label: "fallback", confidence: 1 - a.complete.noul };
  return verdict.label === "safe" ? { label: "safe", confidence: Math.min(verdict.confidence!, a.complete.noul) } : verdict;
};

// The gate again, with the completeness check split into three narrow questions.
const gated3: P = (a, state) => {
  const verdict = ungated(a, state);
  const whole = Math.min(a.starts_whole.noul, a.ends_whole.noul, a.legible.noul);
  if (verdict.label === "safe" && whole < COMPLETE_AT) return { label: "fallback", confidence: 1 - whole };
  return verdict.label === "safe" ? { label: "safe", confidence: Math.min(verdict.confidence!, whole) } : verdict;
};

await runExperiment<State, typeof questions>({
  dir: import.meta.dirname,
  questions,
  critical: "safe",
  predict: { ungated, gated, gated3 },
});
