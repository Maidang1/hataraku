import Anthropic from "@anthropic-ai/sdk";
import { getEffectiveConfig } from "../config";

const config = getEffectiveConfig();

console.log("config", config);

const client = new Anthropic({
  baseURL: config.baseURL || process.env.ANTHROPIC_BASE_URL,
  authToken: config.authToken || process.env.ANTHROPIC_AUTH_TOKEN,
  apiKey: config.apiKey,
});

export { client };
