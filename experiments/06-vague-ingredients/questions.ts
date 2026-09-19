import { noul } from "@typesafe-ai/sdk";
import { questions as labelQuestions } from "../03-gluten-labels/questions.ts";

// Every question and threshold for this experiment lives in this file.
//
// NOT MEDICAL ADVICE. See experiment 03.

// Thresholds were fixed before the first run and not tuned afterwards.
/** A vague-ingredient question at or above this turns `safe` into `caution`. */
export const VAGUE_AT = 0.5;
/** A gluten-free claim at or above this covers vague ingredients, as the LLM's prompt lets it. */
export const CLAIM_AT = 0.5;
export { CLEAR_BELOW, SOURCE_AT, SOURCES } from "../03-gluten-labels/questions.ts";

const { wheat, barley, rye, oats, other_source, may_contain } = labelQuestions;
const LIST = " `ingredients` is a food product's ingredient list and may be in any language.";

export const questions = {
  // Experiment 03's questions, unchanged.
  wheat, barley, rye, oats, other_source, may_contain,

  // The policy experiment 05 found in the LLM's prompt: an ingredient whose
  // source is not named "could hide gluten". One narrow question per kind.
  vague_flavouring: noul("Does the list include a flavouring, aroma or natural flavour whose source is not named?" + LIST),
  vague_spice: noul("Does the list include spices, seasoning or a spice blend without saying what is in it?" + LIST),
  vague_starch: noul(
    "Does the list include starch, modified starch, maltodextrin, dextrin or glucose syrup without naming the plant it comes from?" + LIST,
  ),
  vague_other: noul(
    "Does the list include yeast extract, hydrolysed protein, soy sauce or another processed ingredient that is sometimes made from a gluten-containing cereal, without naming its source?" + LIST,
  ),
  gf_claim: noul("Does the text state that the product is gluten-free?" + LIST),

  // The same policy as one compound question, to compare the two shapes.
  vague_any: noul(
    "Does the list include any ingredient whose source is not named and which could be made from a gluten-containing cereal, such as an unspecified flavouring, spice blend, starch, maltodextrin or yeast extract?" + LIST,
  ),
};

export const VAGUE = ["vague_flavouring", "vague_spice", "vague_starch", "vague_other"] as const;
