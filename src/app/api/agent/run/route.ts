import { handleBrainstormAgentRun } from "@/features/idea-tree/brainstorm-agent-api";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: "invalid_json",
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  return handleBrainstormAgentRun({
    apiKey: process.env.OPENAI_API_KEY,
    body,
  });
}
