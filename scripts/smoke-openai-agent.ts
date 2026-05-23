import { config } from "dotenv";
import type { BrainstormOpenAIClient } from "../src/features/idea-tree/brainstorm-agent";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("OPENAI_API_KEY is not configured. Add it to .env.local or the Eazo environment.");
  process.exit(2);
}

const [{ default: OpenAI }, agentModule, applyModule, smokeModule] = await Promise.all([
  import("openai"),
  import("../src/features/idea-tree/brainstorm-agent"),
  import("../src/features/idea-tree/apply-agent-operations"),
  import("../src/features/idea-tree/brainstorm-agent-smoke"),
]);

const model = process.env.OPENAI_AGENT_MODEL ?? agentModule.DEFAULT_BRAINSTORM_AGENT_MODEL;
const request = smokeModule.createBrainstormAgentSmokeRequest();

try {
  const response = await agentModule.runBrainstormAgent({
    client: new OpenAI({ apiKey }) as unknown as BrainstormOpenAIClient,
    request,
    model,
  });
  const result = applyModule.applyAgentResponseToIdeaTree(request.state, response);
  const summary = smokeModule.summarizeBrainstormAgentSmokeResult({
    model,
    response,
    result,
  });

  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  if (status === 429 || /quota|billing|insufficient_quota|rate limit/i.test(message)) {
    console.error(
      "OpenAI smoke request was rejected by quota or rate limits. Check billing/quota or use another key.",
    );
    process.exit(3);
  }

  console.error(`OpenAI smoke request failed: ${message}`);
  process.exit(1);
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
