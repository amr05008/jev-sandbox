import { runExperiment } from "../../lib/run.ts";
import { questions, questionsWithContext, UNCERTAIN_BELOW, type State } from "./questions.ts";

// node --env-file=.env experiments/01-email-triage/run.ts          fixtures (default, safe on camera)
// node --env-file=.env experiments/01-email-triage/run.ts --real   data/real/ (gitignored)
// add --context to include the dataset's recipient.json in every item's state
await runExperiment<State, typeof questions>({
  dir: import.meta.dirname,
  questions,
  questionsWithContext,
  positive: "needs-attention",
  predict: ({ triage }) => ({
    label: triage.confidence < UNCERTAIN_BELOW ? "uncertain" : triage.choice,
    confidence: triage.confidence,
    score: triage.probabilities["needs-attention"],
  }),
});
