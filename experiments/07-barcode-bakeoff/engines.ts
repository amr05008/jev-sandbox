import type { TypeSafeClient } from "@typesafe-ai/sdk";
import { MODEL as JEV_MODEL } from "../../lib/client.ts";
import { ALL, CLEAR_BELOW, SOURCE_AT, SOURCES, questions, type QuestionName } from "./questions.ts";
import type { Product, Scanner } from "./scanner.ts";

export const CLAUDE_MODELS = { opus: "claude-opus-4-8", haiku: "claude-haiku-4-5" } as const;
export type ClaudeEngine = keyof typeof CLAUDE_MODELS;

// $ per million tokens: [input, output]. Cache reads bill at 0.1× input and
// cache writes at 1.25× input.
const PRICES: Record<ClaudeEngine, [number, number]> = { opus: [5, 25], haiku: [1, 5] };
/** Per-call estimate for the spend preview (measured 2026-09-24 on the Opus probe; Haiku uncached). */
export const EST_PER_CALL: Record<ClaudeEngine | "jev", number> = { opus: 0.0066, haiku: 0.0045, jev: 0.00005 };

export function costOf(engine: ClaudeEngine, usage: any): number {
  const [inp, out] = PRICES[engine];
  const input =
    (usage?.input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0) * 0.1 + (usage?.cache_creation_input_tokens ?? 0) * 1.25;
  return (input * inp + (usage?.output_tokens ?? 0) * out) / 1e6;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The scanner's production barcode request, byte for byte (its analyzeWithClaude
 * → callClaude): raw fetch, its prompt and cache marker, max_tokens 2048, no
 * thinking. Only the model id changes between engines.
 */
export async function askClaude(engine: ClaudeEngine, product: Product, s: Scanner) {
  const context = s.buildIngredientContext(product);
  if (!context) return { skipped: "no_context" as const };
  const body = JSON.stringify({
    model: CLAUDE_MODELS[engine],
    max_tokens: 2048,
    messages: [{ role: "user", content: s.buildCachedContent(s.CLAUDE_PROMPT, `### Product Data:\n${context}`) }],
  });
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(60_000),
    }).catch(() => null);
    const latencyMs = Math.round(performance.now() - started);
    if (res?.ok) {
      const data: any = await res.json();
      const text: string = data.content?.find((b: any) => b.type === "text")?.text ?? "";
      const parsed = s.parseClaudeResponse(text);
      return {
        model: data.model as string,
        verdict: parsed.verdict as string,
        caution_reason: (parsed.caution_reason ?? null) as string | null,
        confidence: parsed.confidence as string,
        explanation: parsed.explanation as string,
        latencyMs,
        usage: data.usage,
        cost: costOf(engine, data.usage),
        stop_reason: data.stop_reason as string,
        attempts: attempt + 1,
      };
    }
    // 4xx other than 429 won't fix itself (spend limit, bad request): stop the run.
    if (res && res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    if (attempt >= 5) throw new Error(`gave up after ${attempt + 1} attempts (last status ${res?.status ?? "network"})`);
    await sleep(Math.min(60_000, Number(res?.headers.get("retry-after") ?? 0) * 1000 || 2000 * 2 ** attempt));
  }
}

export type Nouls = Record<QuestionName, number>;

/**
 * Jev on the ingredient text only. No SDK retries, so the latency is one round
 * trip: what a production fast path with zero retries would see.
 */
export async function askJev(client: TypeSafeClient, product: Product) {
  const ingredients = (product.ingredients_text ?? "").trim();
  if (!ingredients) return { skipped: "no_text" as const };
  const started = performance.now();
  try {
    const res = await client.systemOne(
      { model: JEV_MODEL, state: { ingredients }, questions },
      { timeout: 10_000, retry: { maxRetries: 0 } },
    );
    const latencyMs = Math.round(performance.now() - started);
    const nouls = Object.fromEntries(ALL.map((k) => [k, (res.answers as any)[k].noul as number])) as Nouls;
    return { model: res.model, nouls, latencyMs, usage: res.usage };
  } catch (err: any) {
    return { error: String(err?.message ?? err), latencyMs: Math.round(performance.now() - started) };
  }
}

export interface E2Result {
  settled: boolean;
  verdict?: "safe" | "unsafe";
  explanation?: string;
  /** Which branch decided: `safe`, `unsafe`, or the reason it fell through to Claude. */
  via: string;
}

const fall = (via: string): E2Result => ({ settled: false, via });

/**
 * E2: code gates first, then Jev's scores, then this rule. It settles only a
 * clear `unsafe` or `safe`; everything else falls through to Claude. Never
 * settles `caution` in this round. See plans/barcode-bakeoff-2026-09-24.md.
 */
export function e2Rule(p: Product, a: Nouls | null, s: Scanner): E2Result {
  const text = (p.ingredients_text ?? "").trim();
  const labels = Array.isArray(p.labels_tags) ? p.labels_tags : [];
  if (p.source !== "openfoodfacts") return fall("source");
  if (!text) return fall("no_text");
  if (s.hasGlutenFreeLabelTag(labels)) return fall("gf_label");
  if (s.adverseGlutenLabels(labels).length > 0 || s.unrecognizedGlutenLabels(labels).length > 0) return fall("label_text");
  if (s.assessGlutenSignal(p)) return fall("signal_note");
  if (!a) return fall("jev_error");

  const match = text.match(s.GLUTEN_GRAIN_PATTERN);
  const source = Math.max(...SOURCES.map((k) => a[k]));
  if (source >= SOURCE_AT && match && a.may_contain < SOURCE_AT) {
    return { settled: true, verdict: "unsafe", via: "unsafe", explanation: `Lists "${match[0]}", which contains gluten.` };
  }

  // A gluten-family allergen or trace tag blocks safe only: OFF tags nearly
  // every wheat product en:gluten, so it can't block unsafe.
  const tagged = [...(p.allergens_tags ?? []), ...(p.traces_tags ?? [])].some((t) => s.isGlutenFamilyTag(t));
  const danger = Math.max(...ALL.map((k) => a[k]));
  if (!tagged && !match && danger < CLEAR_BELOW) {
    return { settled: true, verdict: "safe", via: "safe", explanation: "No gluten ingredients are listed and there's no may-contain warning." };
  }
  return fall(tagged ? "gluten_tag" : match ? "pattern_match" : "not_clear");
}
