// records.jsonl is sorted by language × class (its first 166 are all German),
// so a plain prefix would be one stratum. This seeded order shuffles within each
// stratum, then interleaves strata in proportion: any --limit=N prefix is a
// near-proportional sample, and raising N later keeps every earlier item, so a
// run can stop early and resume to the full set without re-spending.
export function stratifiedOrder<T extends { id: string; group: string | null; expected03: string | null }>(rows: T[]): T[] {
  let seed = 20260924; // mulberry32, as in experiment 05
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const strata = new Map<string, T[]>();
  for (const r of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
    const k = `${r.group}/${r.expected03}`;
    strata.set(k, [...(strata.get(k) ?? []), r]);
  }
  return [...strata.keys()].sort().flatMap((k) => {
    const shuffled = strata.get(k)!.map((r) => [random(), r] as const).sort((a, b) => a[0] - b[0]).map(([, r]) => r);
    return shuffled.map((r, i) => [(i + random()) / shuffled.length, r] as const);
  }).sort((a, b) => a[0] - b[0]).map(([, r]) => r);
}
