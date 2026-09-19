import { choice, noul } from "@typesafe-ai/sdk";

// Every question and threshold for this experiment lives in this file.
//
// NOT MEDICAL ADVICE. This measures a model against a public database's allergen
// tags. Nothing here is validated for deciding what a person with celiac
// disease can eat.

/** One product's ingredient list, as printed on the package, in any language. */
export interface State {
  ingredients: string;
}

// Thresholds were fixed before the first run and not tuned afterwards.
/** Noul head: any gluten-source question at or above this makes it unsafe. */
export const SOURCE_AT = 0.5;
/** Noul head: safe only if every danger question is below this. */
export const CLEAR_BELOW = 0.2;
/** Choice head: below this confidence the verdict becomes `uncertain`. */
export const UNCERTAIN_BELOW = 0.6;

const LIST = " `ingredients` is a food product's ingredient list and may be in any language.";

export const questions = {
  // Shape A: one three-way judgment.
  verdict: choice("For a person who must avoid gluten, how should this product be treated?" + LIST, {
    unsafe:
      "Contains wheat, barley, rye, spelt, kamut, triticale, or anything made from them, such as malt, malt extract, seitan or brewer's yeast. Oats count unless the list says they are gluten-free.",
    caution:
      "No gluten-containing ingredient is listed, but the list warns that the product may contain, or is made alongside, gluten or gluten-containing cereals.",
    safe: "No gluten-containing ingredient and no such warning.",
  }),

  // Shape B: one narrow yes/no per reason a product could be a problem. Code
  // combines them; the model never sees the rule.
  wheat: noul("Does the list include wheat or a wheat-derived ingredient, including spelt, kamut, durum, semolina, farro or triticale?" + LIST),
  barley: noul("Does the list include barley or a barley-derived ingredient, including malt, malt extract, malt syrup or malt vinegar?" + LIST),
  rye: noul("Does the list include rye or a rye-derived ingredient?" + LIST),
  oats: noul("Does the list include oats that are not described as gluten-free?" + LIST),
  other_source: noul("Does the list name gluten itself, seitan, brewer's yeast, or another gluten-containing ingredient not made from wheat, barley, rye or oats?" + LIST),
  may_contain: noul("Does the list carry a warning that the product may contain, or is produced alongside, gluten or a gluten-containing cereal?" + LIST),
};

export const SOURCES = ["wheat", "barley", "rye", "oats", "other_source"] as const;
