import { readdirSync } from "node:fs";
import { readJsonl, writeJsonl, type Item, type RunRecord } from "../../lib/items.ts";
import { upper95 } from "../../lib/score.ts";
import type { State } from "./questions.ts";

// Second opinion on the reference labels. Open Food Facts' allergen tags turned
// out to be wrong far more often than the model (see RESULTS.md), so this
// compares Jev against what the ingredient text itself visibly says, using a
// deliberately dumb multilingual keyword list as an independent witness.
//
// The keyword list is NOT ground truth either. Where it and Jev disagree, the
// rows go to raw/disagreements.jsonl for a person to read. That is the point:
// two imperfect witnesses, and a short list to adjudicate by hand.
//
// node experiments/03-gluten-labels/analyze.ts [--head=nouls]

// JavaScript's \b is ASCII-only even with the u flag, so "blé" followed by a
// space has no boundary, and \\w stops at "ß". Letter classes do the job.
const GLUTEN_WORD = new RegExp(
  "(?<!\\p{L})(" +
    [
      "wheat", "bl[ée]e?s?", "froment", "trigo", "tarwe\\p{L}*", "\\p{L}*weizen\\p{L}*", "frumento", "grano (tenero|duro)", "farina di grano",
      "barley", "orge", "cebada", "gerst\\p{L}*", "orzo", "rye", "seigle", "centeno", "rogge\\p{L}*", "segale",
      "spelt", "[ée]peautre", "espelta", "dinkel\\p{L}*", "farro", "kamut", "triticale", "durum",
      "malt", "malted", "malta", "malte", "malz\\p{L}*", "\\p{L}*mout", "moutextract", "seitan",
      "oats?", "avoine", "avena", "haver\\p{L}*", "hafer\\p{L}*",
      "semolina", "semoule", "s[ée]mola", "semola", "couscous", "bulgur",
    ].join("|") +
    ")(?!\\p{L})",
  "giu",
);

// Phrases that contain a gluten word but mean the opposite, or a different plant.
const NOT_GLUTEN = new RegExp(
  [
    "sans gluten", "gluten[- ]?free", "senza glutine", "sin gluten", "sense gluten", "glutenfrei\\p{L}*", "glutenvrij\\p{L}*", "weizenfrei",
    "grano saraceno", "bl[ée] noir", "sarrasin", "buckwheat", "buchweizen\\p{L}*", "boekweit\\p{L}*", "trigo sarraceno",
    "s[ée]mola de ma[ií]z", "semoule de ma[iï]s", "semola di mais", "[ée]chalote en semoule",
  ].join("|"),
  "giu",
);

export const glutenWords = (text: string): string[] => [
  ...new Set([...text.replace(NOT_GLUTEN, " ").matchAll(GLUTEN_WORD)].map((m) => m[0].toLowerCase())),
];

const head = process.argv.find((a) => a.startsWith("--head="))?.split("=")[1] ?? "nouls";
const dir = import.meta.dirname;
const latest = readdirSync(`${dir}/raw`).filter((f) => f.startsWith(`public-${head}-`)).sort().at(-1);
if (!latest) throw new Error(`no raw/public-${head}-* run found; run with --public first`);

const items = new Map(readJsonl<Item<State>>(`${dir}/data/public/items.jsonl`).map((i) => [i.id, i]));
const records = readJsonl<RunRecord>(`${dir}/raw/${latest}`);

const cell = { wordYes: { safe: 0, other: 0 }, wordNo: { safe: 0, other: 0 } };
const disagreements: unknown[] = [];
for (const r of records) {
  const text = items.get(r.id)!.state.ingredients;
  const words = glutenWords(text);
  const jevSafe = r.predicted === "safe";
  cell[words.length > 0 ? "wordYes" : "wordNo"][jevSafe ? "safe" : "other"]++;
  if (words.length > 0 === jevSafe && r.predicted !== "caution") {
    disagreements.push({ id: r.id, group: r.group, database: r.expected, jev: r.predicted, words, text });
  }
}

writeJsonl(`${dir}/raw/disagreements.jsonl`, disagreements);
const listed = cell.wordYes.safe + cell.wordYes.other;
console.log(`head: ${head}   run: ${latest}`);
console.log(`\n| text visibly lists a gluten word | Jev: safe | Jev: unsafe / caution / uncertain |`);
console.log(`| --- | --- | --- |`);
console.log(`| yes (${listed}) | ${cell.wordYes.safe} | ${cell.wordYes.other} |`);
console.log(`| no (${cell.wordNo.safe + cell.wordNo.other}) | ${cell.wordNo.safe} | ${cell.wordNo.other} |`);
console.log(
  `\nJev said safe on ${cell.wordYes.safe} of ${listed} labels where the keyword list sees gluten. ` +
    `If every one of those is a keyword error, the 95% upper bound on Jev's miss rate is ` +
    `${((upper95(0, listed) ?? 0) * 100).toFixed(2)}%; read them in raw/disagreements.jsonl before believing that.`,
);
console.log(`disagreements to read by hand: ${disagreements.length} → raw/disagreements.jsonl`);
