import { describe, expect, test } from "bun:test";

import {
  createBrainstormAgentSmokeRequest,
  summarizeBrainstormAgentSmokeResult,
} from "./brainstorm-agent-smoke";
import { applyAgentResponseToIdeaTree } from "./apply-agent-operations";

describe("brainstorm agent smoke helpers", () => {
  test("builds a minimal request that asks the real agent to update the tree", () => {
    const request = createBrainstormAgentSmokeRequest();

    expect(request.userMessage).toContain("继续长出");
    expect(request.allowWebSearch).toBe(false);
    expect(request.focusedNodeId).toBe(request.state.rootNodeId);
    expect(Object.values(request.state.nodes)).toHaveLength(1);
  });

  test("summarizes smoke output without exposing raw model payloads or secrets", () => {
    const request = createBrainstormAgentSmokeRequest();
    const agentResponse = {
      message: "我先长出两个方向。",
      operations: [
        {
          type: "create_nodes" as const,
          parentNodeId: request.state.rootNodeId,
          ideas: [{ title: "更小试用场景" }, { title: "换个内容角度" }],
        },
      ],
    };
    const result = applyAgentResponseToIdeaTree(request.state, agentResponse);

    const summary = summarizeBrainstormAgentSmokeResult({
      model: "gpt-test",
      response: agentResponse,
      result,
    });

    expect(summary).toEqual({
      ok: true,
      model: "gpt-test",
      operationTypes: ["create_nodes"],
      appliedOperations: ["create_nodes"],
      ignoredOperations: [],
      activeNodeTitles: [
        "想做一个让人把模糊想法想清楚的 brainstorm 工具",
        "更小试用场景",
        "换个内容角度",
      ],
      clearVersionCount: 0,
    });
  });
});
