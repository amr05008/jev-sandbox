import { noul } from "@typesafe-ai/sdk";

// Every question and threshold for this experiment lives in this file.
// Same items as experiment 01; see ../01-email-triage/questions.ts for State.

// Thresholds were fixed before the first run and not tuned afterwards.
/** Any reason at or above this flags the email. */
export const FLAG_AT = 0.5;
/** Every reason below this makes it routine. Anything in between is uncertain. */
export const ROUTINE_BELOW = 0.2;

const FROM = " Judge from `sender_name`, `sender_email` and `subject`.";
/** Appended for the `--context` variant. The only wording difference between the two runs. */
const USE_RECIPIENT = " `recipient` describes the person receiving this email; judge for them specifically.";

// One narrow yes/no per reason an email could deserve an interruption. Code
// decides how they combine; the model never sees the combination rule.
const build = (tail: string) => ({
  security: noul(
    "Is this a security alert about one of the recipient's own accounts, such as a sign-in, password or access change?" + tail,
  ),
  money: noul(
    "Does this report a billing, payment or account problem that the recipient may need to act on? A receipt or a successful payment does not count." + tail,
  ),
  person_waiting: noul(
    "Is a real person, not an automated system, waiting on a reply or an action from the recipient?" + tail,
  ),
  opportunity: noul(
    "Is a real person reaching out personally about a specific opportunity, such as a role, a talk, a podcast or a collaboration? Mass recruiting or sales mail does not count." + tail,
  ),
  care_provider: noul(
    "Is a school, childcare, medical or legal provider asking the recipient to do something?" + tail,
  ),
});

export const questions = build(FROM);
export const questionsWithContext = build(FROM + USE_RECIPIENT);
export type Reason = keyof typeof questions;
