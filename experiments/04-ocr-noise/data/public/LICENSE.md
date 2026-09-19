# Data licence

`items.jsonl` is derived from the [Open Food Facts](https://world.openfoodfacts.org)
sample in `../../../03-gluten-labels/data/public/` by
`scripts/build-ocr-noise.ts`, which damages the ingredient text on purpose
(character noise, line breaks, column bleed, truncation). The damaged text is
synthetic; the underlying entries are © Open Food Facts contributors, under
the [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/)
and the [Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/),
and this derived file is redistributed under the same terms.
