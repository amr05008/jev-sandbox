import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

// Loads the scanner's barcode prompt, helpers and frozen eval cases from a
// local checkout at run time, the way experiment 05 loads the photo prompt.
// Nothing is copied into this repo.

export interface Product {
  source: string;
  product_name?: string;
  brand?: string;
  ingredients_text?: string | null;
  allergens_tags?: string[] | null;
  traces_tags?: string[] | null;
  labels_tags?: string[] | null;
}

export interface EvalCase {
  id: string;
  expect: "safe" | "caution" | "unsafe" | "not-safe";
  reason?: string;
  why: string;
  product: Product;
}

export function loadScanner(path: string) {
  const require = createRequire(import.meta.url);
  const barcode = require(`${path}/api/barcode.js`);
  const utils = require(`${path}/api/_utils.js`);
  const { BARCODE_GF_CLAIM_CASES } = require(`${path}/web/tests/api/evals/barcode-gf-claim-cases.js`);
  const { BARCODE_CALIBRATION_CASES } = require(`${path}/web/tests/api/evals/calibration-cases.js`);
  const git = (...args: string[]) => execFileSync("git", ["-C", path, ...args], { encoding: "utf8" }).trim();
  if (!(barcode.GLUTEN_GRAIN_PATTERN instanceof RegExp)) {
    throw new Error(`${path}/api/barcode.js does not export GLUTEN_GRAIN_PATTERN (needs the bake-off export commit)`);
  }
  return {
    CLAUDE_PROMPT: barcode.CLAUDE_PROMPT as string,
    buildIngredientContext: barcode.buildIngredientContext as (p: Product) => string | null,
    parseClaudeResponse: barcode.parseClaudeResponse as (text: string) => any,
    lookupOpenFoodFacts: barcode.lookupOpenFoodFacts as (barcode: string) => Promise<Product | null>,
    hasGlutenFreeLabelTag: barcode.hasGlutenFreeLabelTag as (tags: unknown) => boolean,
    adverseGlutenLabels: barcode.adverseGlutenLabels as (tags: string[]) => string[],
    unrecognizedGlutenLabels: barcode.unrecognizedGlutenLabels as (tags: string[]) => string[],
    assessGlutenSignal: barcode.assessGlutenSignal as (p: Product) => string | null,
    isGlutenFamilyTag: barcode.isGlutenFamilyTag as (tag: string) => boolean,
    GLUTEN_GRAIN_PATTERN: barcode.GLUTEN_GRAIN_PATTERN as RegExp,
    buildCachedContent: utils.buildCachedContent as (staticText: string, dynamicText: string) => unknown,
    evalCases: [...BARCODE_GF_CLAIM_CASES, ...BARCODE_CALIBRATION_CASES] as EvalCase[],
    commit: git("rev-parse", "--short", "HEAD"),
    dirty: git("status", "--porcelain", "--", "api", "web/tests/api/evals") !== "",
  };
}

export type Scanner = ReturnType<typeof loadScanner>;
