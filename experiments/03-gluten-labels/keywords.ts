// A deliberately dumb multilingual keyword witness for "does this text visibly
// list a gluten ingredient?". Independent of both the model and the database,
// and wrong in its own ways (it cannot read "flour" as wheat flour, and it needs
// an exception list for gluten-free oats). It is a second opinion, not truth.

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
