import assert from "node:assert/strict";
import { test } from "node:test";
import type { RunRecord } from "./items.ts";
import { formatSummary, summarize, upper95 } from "./score.ts";

const rec = (expected: string, predicted: string, confidence: number, latencyMs = 100): RunRecord => ({
  id: `${expected}-${predicted}-${confidence}`,
  expected,
  predicted,
  confidence,
  latencyMs,
  inputTokens: 10,
  outputTokens: 1,
  model: "test",
  answers: {},
});

test("agreement, confusion and tokens", () => {
  const s = summarize([rec("a", "a", 0.9), rec("a", "b", 0.6), rec("b", "b", 0.99), rec("b", "b", 0.4)]);
  assert.equal(s.n, 4);
  assert.equal(s.agreement, 0.75);
  assert.deepEqual(s.confusion, { a: { a: 1, b: 1 }, b: { b: 2 } });
  assert.deepEqual(s.tokens, { input: 40, output: 4 });
});

test("confidence gating trades coverage for agreement", () => {
  const s = summarize([rec("a", "a", 0.9), rec("a", "b", 0.6), rec("b", "b", 0.99), rec("b", "b", 0.4)], { thresholds: [0.5, 0.8] });
  assert.deepEqual(s.gating, [
    { threshold: 0.5, coverage: 0.75, agreement: 2 / 3 },
    { threshold: 0.8, coverage: 0.5, agreement: 1 },
  ]);
});

test("unlabeled items count toward n and latency but not agreement", () => {
  const unlabeled = { ...rec("x", "a", 0.9, 300), expected: undefined };
  const s = summarize([unlabeled]);
  assert.equal(s.labeled, 0);
  assert.equal(s.agreement, null);
  assert.equal(s.latencyMs.p50, 300);
  assert.match(formatSummary(s), /agreement: n\/a/);
});

test("per-class recall and precision expose what agreement hides on skewed data", () => {
  const records = [...Array.from({ length: 9 }, (_, i) => rec("routine", "routine", 0.9 + i / 1000)), rec("urgent", "routine", 0.91)];
  const s = summarize(records);
  assert.equal(s.agreement, 0.9);
  assert.deepEqual(s.perClass.urgent, { expected: 1, predicted: 0, recall: 0, precision: null });
  assert.deepEqual(s.perClass.routine, { expected: 9, predicted: 10, recall: 1, precision: 0.9 });
});

test("AUC ranks the positive class by score, independent of thresholds", () => {
  const r = (expected: string, score: number): RunRecord => ({ ...rec(expected, "x", 0.9), score });
  const perfect = summarize([r("hit", 0.9), r("hit", 0.6), r("miss", 0.5), r("miss", 0.1)], { positive: "hit" });
  assert.equal(perfect.auc, 1);
  const mixed = summarize([r("hit", 0.9), r("hit", 0.2), r("miss", 0.5), r("miss", 0.1)], { positive: "hit" });
  assert.equal(mixed.auc, 0.75);
  assert.equal(summarize([r("hit", 0.9)], { positive: "hit" }).auc, null);
});

test("critical label: wrong rate falls as the confidence bar rises, with an honest upper bound", () => {
  const records = [
    rec("safe", "safe", 0.99),
    rec("safe", "safe", 0.95),
    rec("unsafe", "safe", 0.7), // the costly error
    rec("unsafe", "unsafe", 0.99),
  ];
  const c = summarize(records, { thresholds: [0.9], critical: "safe" }).critical!;
  assert.deepEqual(c.rows.map((r) => [r.threshold, r.settled, r.wrong]), [[0, 3, 1], [0.9, 2, 0]]);
  // Zero wrong out of 2 proves almost nothing: the bound is capped at 100%.
  assert.equal(c.rows[1]!.upper95, 1);
  assert.equal(upper95(0, 3000), 0.001);
  assert.ok(upper95(1, 3)! > 1 / 3);
});
