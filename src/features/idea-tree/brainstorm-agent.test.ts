import { describe, expect, test } from "bun:test";

import {
  BRAINSTORM_AGENT_SYSTEM_PROMPT,
  BrainstormAgentRunRequestSchema,
  buildBrainstormAgentContext,
  buildOpenAIResponsesParams,
} from "./brainstorm-agent";
import {
  createInitialIdeaTreeState,
  getActiveNodes,
  ideaTreeReducer,
} from "./idea-tree-reducer";

describe("brainstorm agent request builder", () => {
  test("builds tree context without active growth access to parked basket ideas", () => {
    let state = createInitialIdeaTreeState("agent-context-1", "一个模糊的研究选题");
    state = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "查公开资料" }, { title: "先做深访" }],
      source: "ai",
    });
    const parked = getActiveNodes(state).find((node) => node.title === "查公开资料");
    state = ideaTreeReducer(state, {
      type: "park_node",
      nodeId: parked!.id,
      reason: "现在不想先查资料",
    });

    const context = buildBrainstormAgentContext({
      state,
      focusedNodeId: state.rootNodeId,
      userMessage: "继续帮我想",
      allowWebSearch: true,
    });

    expect(context.activeNodes.map((node) => node.title)).not.toContain("查公开资料");
    expect(context.ideaBasket.map((node) => node.title)).toEqual(["查公开资料"]);
    expect(context.rules).toContain("idea_basket_is_not_active_context");
  });

  test("keeps the agent framed as a brainstorm partner, not a PRD generator", () => {
    expect(BRAINSTORM_AGENT_SYSTEM_PROMPT).toContain("Brainstorm 思考伙伴");
    expect(BRAINSTORM_AGENT_SYSTEM_PROMPT).toContain("不要默认生成 PRD");
    expect(BRAINSTORM_AGENT_SYSTEM_PROMPT).toContain("结构化操作");
  });

  test("enables OpenAI web search only when the request asks for external material", () => {
    const state = createInitialIdeaTreeState("agent-context-2", "一个模糊的活动主题");
    const parsed = BrainstormAgentRunRequestSchema.parse({
      state,
      userMessage: "找几个相似案例",
      allowWebSearch: true,
    });

    const withSearch = buildOpenAIResponsesParams(parsed, "gpt-test-model");
    const withoutSearch = buildOpenAIResponsesParams(
      { ...parsed, allowWebSearch: false },
      "gpt-test-model",
    );

    expect(withSearch.tools).toEqual([{ type: "web_search_preview" }]);
    expect(withoutSearch.tools).toBeUndefined();
  });

  test("uses an OpenAI structured output schema without oneOf unions", () => {
    const state = createInitialIdeaTreeState("agent-context-3", "一个模糊的创作方向");
    const parsed = BrainstormAgentRunRequestSchema.parse({ state });

    const params = buildOpenAIResponsesParams(parsed, "gpt-test-model");

    expect(JSON.stringify(params.text.format.schema)).not.toContain("oneOf");
  });
});
