import OpenAI from "openai";
import { ZodError } from "zod";

import {
  BrainstormAgentRunRequestSchema,
  runBrainstormAgent,
  type BrainstormOpenAIClient,
} from "./brainstorm-agent";

export async function handleBrainstormAgentRun({
  apiKey,
  body,
  createClient = createOpenAIClient,
  timeoutMs = 45_000,
}: {
  apiKey: string | undefined;
  body: unknown;
  createClient?: (apiKey: string) => BrainstormOpenAIClient;
  timeoutMs?: number;
}): Promise<Response> {
  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        error: "missing_openai_api_key",
        message: "OPENAI_API_KEY is not configured on the server.",
      },
      { status: 503 },
    );
  }

  const request = BrainstormAgentRunRequestSchema.safeParse(body);
  if (!request.success) {
    return Response.json(
      {
        ok: false,
        error: "invalid_agent_request",
        issues: formatZodIssues(request.error),
      },
      { status: 400 },
    );
  }

  try {
    const response = await withTimeout(
      runBrainstormAgent({
        client: createClient(apiKey),
        request: request.data,
      }),
      timeoutMs,
    );

    return Response.json({ ok: true, response });
  } catch (error) {
    if (error instanceof AgentRunTimeoutError) {
      return Response.json(
        {
          ok: false,
          error: "agent_run_timeout",
          message: "Brainstorm agent run timed out.",
        },
        { status: 504 },
      );
    }

    return Response.json(
      {
        ok: false,
        error: "agent_run_failed",
        message: error instanceof Error ? error.message : "Unknown agent error.",
      },
      { status: 502 },
    );
  }
}

function createOpenAIClient(apiKey: string): BrainstormOpenAIClient {
  return new OpenAI({ apiKey }) as unknown as BrainstormOpenAIClient;
}

function formatZodIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

class AgentRunTimeoutError extends Error {
  constructor() {
    super("Brainstorm agent run timed out.");
    this.name = "AgentRunTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new AgentRunTimeoutError()), timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}
