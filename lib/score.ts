import type { RunRecord } from "./items.ts";

export interface Summary {
  n: number;
  labeled: number;
  agreement: number | null;
  confusion: Record<string, Record<string, number>>;
  /** Agreement alone misleads on skewed data: always answering the majority class scores high. */
  perClass: Record<string, { expected: number; predicted: number; recall: number | null; precision: number | null }>;
  /** Chance a random positive outranks a random other item on `score`. Threshold-free. */
  auc: number | null;
  latencyMs: { p50: number; p95: number };
  tokens: { input: number; output: number };
  /** At each confidence threshold: share of items Jev settles alone, and agreement within that share. */
  gating: { threshold: number; coverage: number; agreement: number | null }[];
}

const percentile = (sorted: readonly number[], p: number): number =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;

export function summarize(
  records: readonly RunRecord[],
  thresholds: readonly number[] = [0.5, 0.7, 0.8, 0.9, 0.95],
  positive?: string,
): Summary {
  const labeled = records.filter((r) => r.expected !== undefined);
  const agree = (rs: readonly RunRecord[]): number | null =>
    rs.length === 0 ? null : rs.filter((r) => r.predicted === r.expected).length / rs.length;

  const confusion: Summary["confusion"] = {};
  for (const r of labeled) {
    const row = (confusion[r.expected!] ??= {});
    row[r.predicted] = (row[r.predicted] ?? 0) + 1;
  }

  const perClass: Summary["perClass"] = {};
  for (const label of new Set(labeled.flatMap((r) => [r.expected!, r.predicted]))) {
    const expected = labeled.filter((r) => r.expected === label);
    const predicted = labeled.filter((r) => r.predicted === label);
    const hits = expected.filter((r) => r.predicted === label).length;
    perClass[label] = {
      expected: expected.length,
      predicted: predicted.length,
      recall: expected.length === 0 ? null : hits / expected.length,
      precision: predicted.length === 0 ? null : hits / predicted.length,
    };
  }

  const scored = labeled.filter((r) => r.score !== undefined);
  const pos = scored.filter((r) => r.expected === positive);
  const neg = scored.filter((r) => r.expected !== positive);
  let wins = 0;
  for (const a of pos) for (const b of neg) wins += a.score! > b.score! ? 1 : a.score === b.score ? 0.5 : 0;
  const auc = positive === undefined || pos.length === 0 || neg.length === 0 ? null : wins / (pos.length * neg.length);

  const latencies = records.map((r) => r.latencyMs).sort((a, b) => a - b);

  return {
    n: records.length,
    labeled: labeled.length,
    agreement: agree(labeled),
    confusion,
    perClass,
    auc,
    latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    tokens: {
      input: records.reduce((s, r) => s + r.inputTokens, 0),
      output: records.reduce((s, r) => s + r.outputTokens, 0),
    },
    gating: thresholds.map((threshold) => {
      const kept = labeled.filter((r) => (r.confidence ?? 0) >= threshold);
      return {
        threshold,
        coverage: labeled.length === 0 ? 0 : kept.length / labeled.length,
        agreement: agree(kept),
      };
    }),
  };
}

const pct = (x: number | null): string => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);

/** Aggregates only, so the output is safe to paste into a committed RESULTS.md. */
export function formatSummary(s: Summary): string {
  const labels = [
    ...new Set([...Object.keys(s.confusion), ...Object.values(s.confusion).flatMap(Object.keys)]),
  ].sort();
  const lines = [
    `items: ${s.n} (${s.labeled} labeled)`,
    `agreement: ${pct(s.agreement)}`,
    ...(s.auc === null ? [] : [`ranking AUC: ${s.auc.toFixed(3)}`]),
    `latency: p50 ${s.latencyMs.p50.toFixed(0)}ms, p95 ${s.latencyMs.p95.toFixed(0)}ms`,
    `tokens: ${s.tokens.input} in, ${s.tokens.output} out`,
    "",
    "| confidence ≥ | coverage | agreement |",
    "| --- | --- | --- |",
    ...s.gating.map((g) => `| ${g.threshold} | ${pct(g.coverage)} | ${pct(g.agreement)} |`),
  ];
  if (labels.length > 0) {
    lines.push(
      "",
      "| class | expected | predicted | recall | precision |",
      "| --- | --- | --- | --- | --- |",
      ...labels.map((l) => {
        const c = s.perClass[l]!;
        return `| ${l} | ${c.expected} | ${c.predicted} | ${pct(c.recall)} | ${pct(c.precision)} |`;
      }),
      "",
      `| expected ↓ / predicted → | ${labels.join(" | ")} |`,
      `| --- | ${labels.map(() => "---").join(" | ")} |`,
      ...labels.map(
        (e) => `| ${e} | ${labels.map((p) => s.confusion[e]?.[p] ?? 0).join(" | ")} |`,
      ),
    );
  }
  return lines.join("\n");
}
