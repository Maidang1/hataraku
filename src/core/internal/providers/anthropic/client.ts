import Anthropic from "@anthropic-ai/sdk";
import { getEffectiveConfig } from "../../config";

export function createAnthropicClient(): Anthropic {
  const config = getEffectiveConfig();
  return new Anthropic({
    baseURL: config.baseURL || process.env.ANTHROPIC_BASE_URL,
    authToken: config.authToken || process.env.ANTHROPIC_AUTH_TOKEN,
    apiKey: config.apiKey,
  });
}

let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!cachedClient) {
    cachedClient = createAnthropicClient();
  }
  return cachedClient;
}
