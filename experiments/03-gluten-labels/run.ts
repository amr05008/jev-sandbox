import { runExperiment } from "../../lib/run.ts";
import { CLEAR_BELOW, SOURCE_AT, SOURCES, UNCERTAIN_BELOW, questions, type State } from "./questions.ts";

// node --env-file=.env experiments/03-gluten-labels/run.ts            fixtures (60 items)
// node --env-file=.env experiments/03-gluten-labels/run.ts --public   the full Open Food Facts pull
// optional: --limit=200 --concurrency=8
await runExperiment<State, typeof questions>({
  dir: import.meta.dirname,
  questions,
  critical: "safe",
  predict: {
    // Shape A: trust the three-way Choice, unless it is unsure.
    choice: ({ verdict }) => ({
      label: verdict.confidence < UNCERTAIN_BELOW ? "uncertain" : verdict.choice,
      confidence: verdict.confidence,
    }),
    // Shape B: combine the narrow questions in code.
    nouls: (a) => {
      const source = Math.max(...SOURCES.map((k) => a[k].noul));
      const danger = Math.max(source, a.may_contain.noul);
      if (source >= SOURCE_AT) return { label: "unsafe", confidence: source };
      if (a.may_contain.noul >= SOURCE_AT) return { label: "caution", confidence: a.may_contain.noul };
      if (danger < CLEAR_BELOW) return { label: "safe", confidence: 1 - danger };
      return { label: "uncertain", confidence: 1 - danger };
    },
    // Belt and braces: safe only when both shapes independently say safe.
    both: (a) => {
      const danger = Math.max(...SOURCES.map((k) => a[k].noul), a.may_contain.noul);
      const agreeSafe = a.verdict.choice === "safe" && danger < CLEAR_BELOW;
      if (agreeSafe) return { label: "safe", confidence: Math.min(a.verdict.confidence, 1 - danger) };
      if (a.verdict.choice === "safe" || danger < CLEAR_BELOW) return { label: "uncertain", confidence: 0 };
      const source = Math.max(...SOURCES.map((k) => a[k].noul));
      return source >= SOURCE_AT || a.verdict.choice === "unsafe"
        ? { label: "unsafe", confidence: Math.max(source, a.verdict.probabilities.unsafe) }
        : { label: "caution", confidence: a.may_contain.noul };
    },
  },
});
