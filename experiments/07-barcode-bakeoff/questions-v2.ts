import { noul } from "@typesafe-ai/sdk";
import { questions as v1 } from "./questions.ts";

// E2 v2. Written after v1's baseline on D2 items 1–200, tuned only on those
// items and D1 (plan B6). Graded on D2 items 201–996, which no version has
// seen. Changes from v1, each traced to a reviewed miss:
//
// - is_ingredient_list, looks_complete: v1 settled `safe` on text that wasn't a
//   usable list (a list cut off mid-word, nutrition figures, garbled OCR,
//   medicine instructions). The scanner's policy calls that caution
//   (`incomplete`), never a guessed safe.
// - wheat: v1's wheat question fired at 0.65 on "semoule de riz" (rice
//   semolina). Semolina now counts only when it's wheat semolina.
//
// NOT MEDICAL ADVICE.

/** `safe` needs both list-quality questions at or above this. */
export const LIST_OK_AT = 0.8;

const LIST = " `ingredients` is a food product's ingredient list and may be in any language.";
// The list-quality questions must not presuppose that the text is a list.
const FIELD = " `ingredients` is the text of a food database's ingredients field and may be in any language.";

export const questions = {
  ...v1,
  wheat: noul(
    "Does the list include wheat or a wheat-derived ingredient, including spelt, kamut, durum, farro, triticale, or semolina made from wheat? Semolina made from rice, corn or maize does not count." + LIST,
  ),
  is_ingredient_list: noul(
    "Is this text a food product's list of ingredients, rather than nutrition figures, directions for use, medicine instructions, marketing text or other unrelated text?" + FIELD,
  ),
  looks_complete: noul(
    "Does the ingredient list appear complete, ending where a list normally ends, rather than stopping mid-word, mid-ingredient or inside an unclosed bracket?" + FIELD,
  ),
};

export type QuestionName = keyof typeof questions;
export const SOURCES = ["wheat", "barley", "rye", "other_source"] as const;
/** Questions whose high score is a reason not to call the product safe. */
export const DANGER = (Object.keys(questions) as QuestionName[]).filter((k) => k !== "is_ingredient_list" && k !== "looks_complete");
