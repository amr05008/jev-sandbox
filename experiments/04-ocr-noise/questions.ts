import { noul } from "@typesafe-ai/sdk";
import { questions as labelQuestions } from "../03-gluten-labels/questions.ts";

// Every question and threshold for this experiment lives in this file.
//
// NOT MEDICAL ADVICE. See experiment 03.

// Thresholds were fixed before the first run and not tuned afterwards.
/** Below this, the text is treated as damaged and the verdict is withheld. */
export const COMPLETE_AT = 0.5;
export { CLEAR_BELOW, SOURCE_AT, SOURCES } from "../03-gluten-labels/questions.ts";

const { wheat, barley, rye, oats, other_source, may_contain } = labelQuestions;

export const questions = {
  // The same source questions as experiment 03, unchanged, so the only thing
  // that differs between the two experiments is the damage to the text.
  wheat, barley, rye, oats, other_source, may_contain,

  // The new one. A scanner's most dangerous failure is a list that was cut off
  // before the gluten and then read, correctly, as containing none.
  complete: noul(
    "Is `ingredients` a complete ingredient list: it starts at the beginning, it is not cut off at the end, and no stretch of it is too garbled to read? It may be in any language.",
  ),

  // The same check split into its three parts, added after the first run showed
  // the compound question above catching a missing end far better than a
  // missing start. One judgment per question is the rule it broke.
  starts_whole: noul(
    "Does `ingredients` begin at the start of an ingredient list, with a whole first ingredient or a heading, rather than part-way through a word or part-way through the list? It may be in any language.",
  ),
  ends_whole: noul(
    "Does `ingredients` reach the natural end of an ingredient list, rather than stopping part-way through a word, a bracket or the list? It may be in any language.",
  ),
  legible: noul(
    "Is every part of `ingredients` clean enough to read, with no stretch so garbled that an ingredient could not be identified? It may be in any language.",
  ),
};
