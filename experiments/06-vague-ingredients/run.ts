import { runExperiment, type Predict } from "../../lib/run.ts";
import type { State } from "../03-gluten-labels/questions.ts";
import { CLAIM_AT, CLEAR_BELOW, SOURCE_AT, SOURCES, VAGUE, VAGUE_AT, questions } from "./questions.ts";

// node experiments/06-vague-ingredients/build.ts
// node --env-file=.env experiments/06-vague-ingredients/run.ts --public --concurrency=8
type P = Predict<State, typeof questions>;

// Experiment 03's rule: safe unless a gluten source or a may-contain statement is found.
const base: P = (a) => {
  const source = Math.max(...SOURCES.map((k) => a[k].noul));
  const danger = Math.max(source, a.may_contain.noul);
  if (source >= SOURCE_AT) return { label: "unsafe", confidence: source };
  if (a.may_contain.noul >= SOURCE_AT) return { label: "caution", confidence: a.may_contain.noul };
  if (danger < CLEAR_BELOW) return { label: "safe", confidence: 1 - danger };
  return { label: "uncertain", confidence: 1 - danger };
};

// The same rule, plus the vague-ingredient policy: a would-be `safe` becomes
// `caution` when something vague is listed and no gluten-free claim covers it.
const withPolicy = (vagueness: (a: Parameters<P>[0]) => number): P => (a, state) => {
  const verdict = base(a, state);
  const vague = vagueness(a);
  if (verdict.label === "safe" && vague >= VAGUE_AT && a.gf_claim.noul < CLAIM_AT) return { label: "caution", confidence: vague };
  return verdict;
};

await runExperiment<State, typeof questions>({
  dir: import.meta.dirname,
  questions,
  critical: "safe",
  predict: {
    base,
    policy: withPolicy((a) => Math.max(...VAGUE.map((k) => a[k].noul))),
    policy_compound: withPolicy((a) => a.vague_any.noul),
  },
});
