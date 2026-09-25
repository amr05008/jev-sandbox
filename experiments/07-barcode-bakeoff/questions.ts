import { noul } from "@typesafe-ai/sdk";
import { questions as q03 } from "../03-gluten-labels/questions.ts";

// E2's questions and thresholds. Committed before the first run and not tuned
// on its results (plan B5). The first six are experiment 03's, unchanged. The
// last three are new: one per case where the scanner's policy (its decision
// 006) keeps a caution for an ingredient whose gluten source isn't stated.
//
// NOT MEDICAL ADVICE. This compares engines against each other and against a
// scanner's frozen test cases, not against clinical judgment.

/** What Jev sees: the ingredient text only, never the product name or barcode. */
export interface State {
  ingredients: string;
}

/** A source question at or above this counts as present (experiment 03). */
export const SOURCE_AT = 0.5;
/** Safe needs every question below this (experiment 03). */
export const CLEAR_BELOW = 0.2;

const LIST = " `ingredients` is a food product's ingredient list and may be in any language.";

export const questions = {
  wheat: q03.wheat,
  barley: q03.barley,
  rye: q03.rye,
  other_source: q03.other_source,
  oats: q03.oats,
  may_contain: q03.may_contain,
  meat_poultry: noul(
    "Judging from the list, is this product mainly or partly made of meat or poultry, such as a sausage, a soup or meal with chicken, or chili with beef?" + LIST,
  ),
  soy_sauce: noul("Does the list include soy sauce, tamari or shoyu that is not described as gluten-free?" + LIST),
  yeast_extract: noul("Does the list include yeast extract or autolyzed yeast whose source is not stated?" + LIST),
};

export type QuestionName = keyof typeof questions;
export const SOURCES = ["wheat", "barley", "rye", "other_source"] as const;
export const ALL = Object.keys(questions) as QuestionName[];
