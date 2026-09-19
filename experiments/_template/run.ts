import { runExperiment } from "../../lib/run.ts";
import { questions, type State } from "./questions.ts";

// node --env-file=.env experiments/<name>/run.ts          fixtures (default, safe on camera)
// node --env-file=.env experiments/<name>/run.ts --real   data/real/ (gitignored)
await runExperiment<State, typeof questions>({
  dir: import.meta.dirname,
  questions,
  predict: (answers) => ({ label: answers.label.choice, confidence: answers.label.confidence }),
});
