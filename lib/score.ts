import type { RunRecord } from "./items.ts";

export interface ScoreOptions {
  thresholds?: readonly number[];
  /** Class whose `score` is ranked for AUC, if records carry scores. */
  positive?: string;
  /**
   * The label that is expensive to give wrongly, such as "safe" for a food
   * allergen. Adds a table of how often it was given wrongly at each
   * confidence threshold, which is the number that decides whether the model
   * may settle that label without a fallback.
   */
  critical?: string;
}

export interface CriticalRow {
  threshold: number;
  /** Items given the critical label at or above the threshold. */
  settled: number;
  /** Share of all labeled items that represents. */
  coverage: number;
  wrong: number;
  rate: number | null;
  /** Upper 95% bound on the true wrong rate: rule of three when wrong is 0, Wilson otherwise. */
  upper95: number | null;
}

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
  critical: { label: string; rows: CriticalRow[]; byGroup: Record<string, { settled: number; wrong: number }> } | null;
}

/** Upper 95% bound on a proportion. With zero failures this is the rule of three, 3/n. */
export function upper95(wrong: number, n: number): number | null {
  if (n === 0) return null;
  if (wrong === 0) return Math.min(1, 3 / n);
  const z = 1.96;
  const p = wrong / n;
  return (p + (z * z) / (2 * n) + z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
}

const percentile = (sorted: readonly number[], p: number): number =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;

export function summarize(records: readonly RunRecord[], options: ScoreOptions = {}): Summary {
  const { thresholds = [0.5, 0.7, 0.8, 0.9, 0.95], positive, critical: criticalLabel } = options;
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

  let critical: Summary["critical"] = null;
  if (criticalLabel !== undefined) {
    const given = labeled.filter((r) => r.predicted === criticalLabel);
    const byGroup: Record<string, { settled: number; wrong: number }> = {};
    for (const r of given) {
      const g = (byGroup[r.group ?? "all"] ??= { settled: 0, wrong: 0 });
      g.settled++;
      if (r.expected !== criticalLabel) g.wrong++;
    }
    critical = {
      label: criticalLabel,
      byGroup,
      rows: [0, ...thresholds].map((threshold) => {
        const settled = given.filter((r) => (r.confidence ?? 0) >= threshold);
        const wrong = settled.filter((r) => r.expected !== criticalLabel).length;
        return {
          threshold,
          settled: settled.length,
          coverage: labeled.length === 0 ? 0 : settled.length / labeled.length,
          wrong,
          rate: settled.length === 0 ? null : wrong / settled.length,
          upper95: upper95(wrong, settled.length),
        };
      }),
    };
  }

  const latencies = records.map((r) => r.latencyMs).sort((a, b) => a - b);

  return {
    n: records.length,
    labeled: labeled.length,
    agreement: agree(labeled),
    confusion,
    perClass,
    auc,
    critical,
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
  if (s.critical) {
    const c = s.critical;
    const pct2 = (x: number | null): string => (x === null ? "n/a" : `${(x * 100).toFixed(2)}%`);
    lines.push(
      "",
      `Wrongly given \`${c.label}\` (the costly error):`,
      "",
      `| confidence ≥ | given \`${c.label}\` | share of all | wrong | wrong rate | 95% upper bound |`,
      "| --- | --- | --- | --- | --- | --- |",
      ...c.rows.map(
        (r) => `| ${r.threshold} | ${r.settled} | ${pct(r.coverage)} | ${r.wrong} | ${pct2(r.rate)} | ${pct2(r.upper95)} |`,
      ),
    );
    const groups = Object.keys(c.byGroup).sort();
    if (groups.length > 1) {
      lines.push(
        "",
        `| group | given \`${c.label}\` | wrong | wrong rate |`,
        "| --- | --- | --- | --- |",
        ...groups.map((g) => {
          const v = c.byGroup[g]!;
          return `| ${g} | ${v.settled} | ${v.wrong} | ${pct2(v.settled === 0 ? null : v.wrong / v.settled)} |`;
        }),
      );
    }
  }
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
