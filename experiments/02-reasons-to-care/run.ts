import { runExperiment } from "../../lib/run.ts";
import type { State } from "../01-email-triage/questions.ts";
import { FLAG_AT, ROUTINE_BELOW, questions, questionsWithContext } from "./questions.ts";

// node --env-file=.env experiments/02-reasons-to-care/run.ts          fixtures (default, safe on camera)
// node --env-file=.env experiments/02-reasons-to-care/run.ts --real   data/real/ (gitignored)
// add --context to include the dataset's recipient.json in every item's state
await runExperiment<State, typeof questions>({
  dir: import.meta.dirname,
  dataDir: `${import.meta.dirname}/../01-email-triage`,
  questions,
  questionsWithContext,
  positive: "needs-attention",
  predict: (answers) => {
    const strongest = Math.max(...Object.values(answers).map((a) => a.noul));
    const label = strongest >= FLAG_AT ? "needs-attention" : strongest < ROUTINE_BELOW ? "routine" : "uncertain";
    // Confidence in the label given: how far the strongest reason is from the other side.
    return { label, confidence: label === "routine" ? 1 - strongest : strongest, score: strongest };
  },
});
