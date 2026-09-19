import { readJsonl, writeJsonl, type Item } from "../lib/items.ts";
import { glutenWords } from "../experiments/03-gluten-labels/keywords.ts";
import type { State } from "../experiments/03-gluten-labels/questions.ts";

// Builds experiment 04's dataset: clean labels from experiment 03, damaged the
// way phone photos and OCR damage them. Seeded, so the same input gives the
// same output. Derived from Open Food Facts data (ODbL), so it is committed.
//
// node scripts/build-ocr-noise.ts

const SRC = `${import.meta.dirname}/../experiments/03-gluten-labels/data/public/items.jsonl`;
const OUT = `${import.meta.dirname}/../experiments/04-ocr-noise/data/public/items.jsonl`;
const PER_LANG_PER_CLASS = 50;

// mulberry32, keyed per item and variant so one item's damage never depends on another's.
function rng(key: string): () => number {
  let seed = 0;
  for (const ch of key) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Classic OCR confusions, plus dropped and doubled characters and stray spaces.
const CONFUSE: Record<string, string> = {
  l: "1", I: "l", O: "0", "0": "O", m: "rn", e: "c", a: "o", é: "e", è: "e", ü: "u", ö: "o", ä: "a", ß: "B", S: "5", B: "8", i: "í", t: "f", h: "b", n: "ri",
};
function charNoise(text: string, rate: number, rand: () => number): string {
  let out = "";
  for (const ch of text) {
    if (rand() >= rate) out += ch;
    else {
      const kind = rand();
      if (kind < 0.5) out += CONFUSE[ch] ?? ch.toUpperCase();
      else if (kind < 0.75) out += ""; // dropped
      else if (kind < 0.9) out += ch + ch;
      else out += `${ch} `;
    }
  }
  return out;
}

/** Line breaks and end-of-line hyphenation, as a narrow label wraps. */
function lineBreaks(text: string, rand: () => number): string {
  let out = "";
  let col = 0;
  for (const ch of text) {
    out += ch;
    if (++col > 22 + rand() * 10) {
      out += /\p{L}/u.test(ch) ? "-\n" : "\n";
      col = 0;
    }
  }
  return out;
}

const NUTRITION = [
  "Energy 1536 kJ / 367 kcal", "Fat 12 g of which saturates 4,1 g", "Carbohydrate 58 g of which sugars 21 g",
  "Protein 6,9 g Salt 0,83 g", "per 100 g per portion %RI*", "Best before: see base of pack",
];
/** A neighbouring column bleeding into the list, as when a photo catches the nutrition table. */
function columnBleed(text: string, rand: () => number): string {
  const words = text.split(" ");
  for (let i = 0; i < 3; i++) {
    const at = Math.floor(rand() * words.length);
    words.splice(at, 0, NUTRITION[Math.floor(rand() * NUTRITION.length)]!);
  }
  return words.join(" ");
}

/** Cuts land mid-word on purpose: a frame edge does not respect commas. */
const keepHead = (text: string, share: number): string => text.slice(0, Math.floor(text.length * share));
const keepTail = (text: string, share: number): string => text.slice(Math.floor(text.length * (1 - share)));

const VARIANTS: Record<string, (text: string, rand: () => number) => string> = {
  clean: (t) => t,
  noise05: (t, r) => charNoise(t, 0.05, r),
  noise10: (t, r) => charNoise(t, 0.1, r),
  noise20: (t, r) => charNoise(t, 0.2, r),
  linebreaks: lineBreaks,
  bleed: columnBleed,
  "cut-end-30": (t) => keepHead(t, 0.7),
  "cut-end-50": (t) => keepHead(t, 0.5),
  "cut-start-50": (t) => keepTail(t, 0.5),
  "cut-end-50+noise10": (t, r) => charNoise(keepHead(t, 0.5), 0.1, r),
};

export interface Meta {
  variant: string;
  source: string;
  lang: string;
  /** After the damage, can the keyword witness still see a gluten word? */
  gluten_visible: boolean;
}

// Only labels where the database and the keyword witness agree, so the starting
// truth is as solid as experiment 03 could make it.
const source = readJsonl<Item<State> & { group: string }>(SRC).filter((i) => i.state.ingredients.length >= 120);
const items: (Item<State> & { group: string; meta: Meta })[] = [];
for (const lang of ["de", "en", "es", "fr", "it", "nl"]) {
  const inLang = source.filter((i) => i.group === lang);
  const gluten = inLang.filter((i) => i.expected === "unsafe" && glutenWords(i.state.ingredients).length > 0);
  const clear = inLang.filter((i) => i.expected === "safe" && glutenWords(i.state.ingredients).length === 0);
  for (const [expected, pool] of [["unsafe", gluten], ["safe", clear]] as const) {
    for (const item of pool.slice(0, PER_LANG_PER_CLASS)) {
      for (const [variant, damage] of Object.entries(VARIANTS)) {
        const text = damage(item.state.ingredients, rng(`${item.id}/${variant}`));
        items.push({
          id: `${item.id}#${variant}`,
          state: { ingredients: text },
          expected,
          group: variant,
          meta: { variant, source: item.id, lang, gluten_visible: glutenWords(text).length > 0 },
        });
      }
    }
  }
}

writeJsonl(OUT, items);
const hidden = items.filter((i) => i.expected === "unsafe" && !i.meta.gluten_visible);
console.log(`${items.length} items (${Object.keys(VARIANTS).length} variants × ${items.length / Object.keys(VARIANTS).length} labels) → ${OUT}`);
console.log(`gluten labels where the damage hid every gluten word from the keyword witness: ${hidden.length}`);
