import { choice } from "@typesafe-ai/sdk";

// Every question and threshold for this experiment lives in this file.
// This is the part a human reviews, and the part worth showing on screen.

/** Shape of one item's `state` in the items.jsonl files. */
export interface State {
  text: string;
}

export const questions = {
  label: choice("Which label best describes `text`?", {
    a: "Describe when this label applies.",
    b: "Describe when this label applies.",
    none: "Nothing above fits.",
  }),
};
