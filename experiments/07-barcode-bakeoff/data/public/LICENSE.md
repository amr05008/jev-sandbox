# Data licence

`items.jsonl` here and in `../fixtures/` is a sample of the
[Open Food Facts](https://world.openfoodfacts.org) database, taken from the
bulk export dated 2026-09-18 by `scripts/pull-gluten-labels.ts` (seed
`20260918`).

Open Food Facts data is made available under the
[Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/);
individual contents are under the
[Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/).
This sample is redistributed under the same terms. © Open Food Facts
contributors.

Changes made: rows filtered and sampled; ingredient text whitespace-normalised,
HTML entities decoded, and OFF's `_allergen_` underscore markup removed;
`expected` derived from the `allergens` and `traces_tags` columns.

The entries are crowd-sourced and contain errors. See `../../RESULTS.md`.
