import { readFileSync } from "node:fs";
import { readJsonl, writeJsonl, type Item } from "../../lib/items.ts";
import type { State } from "../03-gluten-labels/questions.ts";

// The same 996 labels experiment 05 sent to the LLM, so the two can be paired.
// node experiments/06-vague-ingredients/build.ts
const dir = import.meta.dirname;
const ids = new Set<string>(JSON.parse(readFileSync(`${dir}/../05-llm-side-by-side/data/public/sample-clean.json`, "utf8")));
const items = readJsonl<Item<State>>(`${dir}/../03-gluten-labels/data/public/items.jsonl`).filter((i) => ids.has(i.id));
writeJsonl(`${dir}/data/public/items.jsonl`, items);
console.log(`${items.length} items`);
