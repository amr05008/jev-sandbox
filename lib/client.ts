import { TypeSafeClient } from "@typesafe-ai/sdk";

// Hardcoded on purpose: the SDK falls back to TYPESAFE_BASE_URL from the
// environment, which would silently send requests and the bearer key elsewhere.
const BASE_URL = "https://api.typesafe.ai";

// Pinned so results stay comparable across runs. The SDK default is
// `jev-latest`, which moves. Bump deliberately and note it in RESULTS.md.
export const MODEL = "jev-1.13.0";

export function makeClient(): TypeSafeClient {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "TYPESAFE_API_KEY is not set. Copy .env.example to .env and run with node --env-file=.env",
    );
  }
  return new TypeSafeClient({ apiKey, baseURL: BASE_URL });
}
