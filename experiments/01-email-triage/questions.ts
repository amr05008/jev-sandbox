import { choice, noul } from "@typesafe-ai/sdk";

// Every question and threshold for this experiment lives in this file.

/** Header-only view of an email. No body, by design: see README. */
export interface State {
  sender_name: string;
  sender_email: string;
  subject: string;
}

/** Below this Choice confidence, the prediction becomes "uncertain" (inbox-watcher's fourth class). */
export const UNCERTAIN_BELOW = 0.6;

const TRIAGE =
  "A busy person only wants to be interrupted for email that needs them personally. Judging from `sender_name`, `sender_email` and `subject`, which kind of email is this?";

/** Appended for the `--context` variant. The only wording difference between the two runs. */
const USE_RECIPIENT = " `recipient` describes this person and what they do and do not care about; judge for them specifically.";

const build = (instructions: string) => ({
  triage: choice(
    instructions,
    {
      "needs-attention":
        "A real person or organization is waiting on the recipient: a direct question, a request, a deadline, a scheduling ask, a security or billing problem that requires action.",
      routine:
        "Nothing is waiting on the recipient: newsletters, marketing, receipts, shipping updates, automated notifications, social digests, FYI-only messages.",
    },
  ),
  // Independent signals asked in the same call. Not used for the label yet;
  // recorded in raw/ so later analysis can see which ones track disagreement.
  automated: noul("Was this email sent by an automated system rather than typed by a person?"),
  wants_reply: noul("Is the sender expecting a reply from the recipient?"),
  time_sensitive: noul("Does the subject indicate a deadline or something that expires soon?"),
});

export const questions = build(TRIAGE);
export const questionsWithContext = build(TRIAGE + USE_RECIPIENT);
