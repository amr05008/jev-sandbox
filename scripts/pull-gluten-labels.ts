import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { writeJsonl, type Item } from "../lib/items.ts";
import type { State } from "../experiments/03-gluten-labels/questions.ts";

// Builds experiment 03's dataset from Open Food Facts' bulk export, which is
// what OFF asks bulk users to read instead of the API. Streams the ~1.3 GB
// gzip once, keeps a seeded random sample per language and gluten status, and
// stores nothing else. OFF data is public (ODbL), so unlike the email
// experiments this dataset is committed: data/public/.
//
// node scripts/pull-gluten-labels.ts

const EXPORT = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz";
const OUT = `${import.meta.dirname}/../experiments/03-gluten-labels/data/public/items.jsonl`;
const SEED = 20260918;

const QUOTA = { unsafe: 150, caution: 60, safe_unlabelled: 250, safe_labelled: 90 } as const;
type Stratum = keyof typeof QUOTA;

// The export has no language column. Products sold in exactly one of these
// countries stand in for the language, checked against the text below.
const COUNTRY_LANG: Record<string, string> = {
  "en:united-kingdom": "en",
  "en:united-states": "en",
  "en:ireland": "en",
  "en:spain": "es",
  "en:france": "fr",
  "en:netherlands": "nl",
  "en:germany": "de",
  "en:italy": "it",
};

// A few function words per language. The expected language has to out-score
// every other one, which drops mislabelled and mixed-language entries.
const STOPWORDS: Record<string, string[]> = {
  en: ["and", "of", "with", "contains", "from", "may", "oil", "salt"],
  es: ["y", "de", "con", "sal", "aceite", "puede", "contiene", "azúcar"],
  fr: ["et", "de", "du", "sel", "huile", "peut", "sucre", "eau"],
  nl: ["en", "van", "met", "zout", "kan", "bevat", "suiker", "olie"],
  de: ["und", "aus", "mit", "salz", "kann", "enthalten", "zucker", "wasser"],
  it: ["e", "di", "con", "sale", "olio", "può", "contenere", "zucchero"],
};

function looksLike(lang: string, text: string): boolean {
  const words = text.toLowerCase().split(/[^\p{L}]+/u);
  const score = (l: string) => words.filter((w) => STOPWORDS[l]!.includes(w)).length;
  const mine = score(lang);
  return mine >= 2 && Object.keys(STOPWORDS).every((l) => l === lang || score(l) < mine);
}

const ENTITIES: Record<string, string> = { "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&#39;": "'", "&apos;": "'" };
const decodeEntities = (t: string): string => t.replace(/&(quot|amp|lt|gt|apos|#39);/g, (m) => ENTITIES[m]!);

// Some entries hold a chatbot's description of the photo instead of the label text.
const NOT_A_LABEL = /\b(i can see|i cannot|i can't|this label|the image|the photo|not visible|unable to)\b/i;

// mulberry32: small seeded PRNG so the same export yields the same sample.
let seed = SEED;
const random = (): number => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export interface Meta {
  lang: string;
  gf_label: boolean;
}
type Row = Item<State> & { group: string; meta: Meta };

const reservoirs = new Map<string, { seen: number; rows: Row[] }>();
function offer(key: string, quota: number, row: Row): void {
  const r = reservoirs.get(key) ?? { seen: 0, rows: [] };
  reservoirs.set(key, r);
  r.seen++;
  if (r.rows.length < quota) r.rows.push(row);
  else {
    const j = Math.floor(random() * r.seen);
    if (j < quota) r.rows[j] = row;
  }
}

const res = await fetch(EXPORT);
if (!res.ok || !res.body) throw new Error(`export fetch failed: ${res.status}`);
console.error(`streaming export, last modified ${res.headers.get("last-modified")}`);
const lines = createInterface({ input: Readable.fromWeb(res.body as never).pipe(createGunzip()), crlfDelay: Infinity });

let col: Record<string, number> | undefined;
let width = 0;
let scanned = 0;
for await (const line of lines) {
  const f = line.split("\t");
  if (!col) {
    col = Object.fromEntries(f.map((name, i) => [name, i]));
    width = f.length;
    continue;
  }
  if (++scanned % 500_000 === 0) console.error(`scanned ${scanned.toLocaleString()} rows`);
  if (f.length !== width) continue;

  const code = f[col.code!]!;
  const countries = f[col.countries_tags!]!.split(",");
  const lang = countries.length === 1 ? COUNTRY_LANG[countries[0]!] : undefined;
  if (!lang || !/^\d{8,14}$/.test(code) || code.startsWith("0000")) continue;
  if (!f[col.states_tags!]!.includes("en:ingredients-completed")) continue;

  // OFF wraps allergens in underscores (_wheat_). That markup is not on the
  // package and would hand the model the answer, so it goes.
  const text = decodeEntities(f[col.ingredients_text!]!).replaceAll("_", "").replace(/\s+/g, " ").trim();
  if (text.length < 30 || text.length > 1200 || !looksLike(lang, text) || NOT_A_LABEL.test(text)) continue;

  const allergen = f[col.allergens!]!.split(",").includes("en:gluten");
  const trace = f[col.traces_tags!]!.split(",").includes("en:gluten");
  const gf_label = f[col.labels_tags!]!.split(",").includes("en:no-gluten");
  if (gf_label && (allergen || trace)) continue; // self-contradictory entry

  const expected = allergen ? "unsafe" : trace ? "caution" : "safe";
  const stratum: Stratum = expected === "safe" ? (gf_label ? "safe_labelled" : "safe_unlabelled") : expected;
  offer(`${lang}/${stratum}`, QUOTA[stratum], {
    id: `off-${code}`,
    state: { ingredients: text },
    expected,
    group: lang,
    meta: { lang, gf_label },
  });
}

const items = [...reservoirs.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, r]) => r.rows);
writeJsonl(OUT, items);
for (const [key, r] of [...reservoirs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.error(`${key}: kept ${r.rows.length} of ${r.seen.toLocaleString()} eligible`);
}
console.log(`done: ${items.length} items from ${scanned.toLocaleString()} rows → ${OUT}`);
