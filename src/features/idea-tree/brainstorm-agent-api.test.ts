import { describe, expect, test } from "bun:test";

import { handleBrainstormAgentRun } from "./brainstorm-agent-api";
import { createInitialIdeaTreeState } from "./idea-tree-reducer";

describe("handleBrainstormAgentRun", () => {
  test("returns a clear error when the OpenAI key is not configured", async () => {
    const response = await handleBrainstormAgentRun({
      apiKey: "",
      body: {
        state: createInitialIdeaTreeState("agent-api-1", "一个模糊想法"),
        userMessage: "继续想",
      },
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "missing_openai_api_key",
      message: "OPENAI_API_KEY is not configured on the server.",
    });
  });

  test("validates the request body before calling the agent", async () => {
    const response = await handleBrainstormAgentRun({
      apiKey: "test-key",
      body: { userMessage: "没有 state" },
      createClient: () => {
        throw new Error("client should not be created");
      },
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body).toMatchObject({ ok: false, error: "invalid_agent_request" });
  });

  test("returns the structured agent response from an injected OpenAI client", async () => {
    const state = createInitialIdeaTreeState("agent-api-2", "一个模糊的命名方向");
    const response = await handleBrainstormAgentRun({
      apiKey: "test-key",
      body: {
        state,
        focusedNodeId: state.rootNodeId,
        userMessage: "问我一个问题",
      },
      createClient: () => ({
        responses: {
          parse: async () => ({
            output_parsed: {
              message: "我先追问一个能帮助发散的问题。",
              operations: [
                {
                  type: "ask_followup",
                  parentNodeId: "",
                  nodeId: state.rootNodeId,
                  ideas: [],
                  question: "这个名字最想给人什么感觉？",
                  nodeIds: [],
                  title: "",
                  description: "",
                  reason: "",
                  summary: "",
                  currentDirection: "",
                  parked: [],
                  uncertain: "",
                  nextThought: "",
                },
              ],
            },
          }),
        },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      response: {
        message: "我先追问一个能帮助发散的问题。",
        operations: [
          {
            type: "ask_followup",
            nodeId: state.rootNodeId,
            question: "这个名字最想给人什么感觉？",
          },
        ],
      },
    });
  });

  test("returns a timeout error when the agent run takes too long", async () => {
    const state = createInitialIdeaTreeState("agent-api-3", "一个模糊的策略初稿");
    const response = await handleBrainstormAgentRun({
      apiKey: "test-key",
      body: {
        state,
        userMessage: "继续想",
      },
      timeoutMs: 1,
      createClient: () => ({
        responses: {
          parse: () => new Promise(() => undefined),
        },
      }),
    });

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "agent_run_timeout",
      message: "Brainstorm agent run timed out.",
    });
  });
});
