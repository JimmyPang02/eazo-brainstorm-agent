import { describe, expect, test } from "bun:test";

import type { BrainstormAgentResponse } from "./agent-operations";
import { applyAgentResponseToIdeaTree } from "./apply-agent-operations";
import {
  createInitialIdeaTreeState,
  getActiveNodes,
  ideaTreeReducer,
} from "./idea-tree-reducer";

describe("applyAgentResponseToIdeaTree", () => {
  test("applies whitelisted agent operations through the idea tree reducer", () => {
    const state = createInitialIdeaTreeState("agent-apply-1", "一个模糊的内容选题");
    const response: BrainstormAgentResponse = {
      message: "先长出几个方向，再追问根想法。",
      operations: [
        {
          type: "create_nodes",
          parentNodeId: state.rootNodeId,
          ideas: [
            { title: "从人物故事切入" },
            { title: "从反常识问题切入" },
          ],
        },
        {
          type: "ask_followup",
          nodeId: state.rootNodeId,
          question: "这期内容最想留下的一个问题是什么？",
        },
      ],
    };

    const result = applyAgentResponseToIdeaTree(state, response);
    const children = getActiveNodes(result.state).filter(
      (node) => node.parentId === state.rootNodeId,
    );

    expect(children.map((node) => node.title)).toEqual([
      "从人物故事切入",
      "从反常识问题切入",
    ]);
    expect(result.state.actions.at(-1)?.type).toBe("grow_from_node");
    expect(result.cards).toEqual([
      {
        type: "followup",
        nodeId: state.rootNodeId,
        question: "这期内容最想留下的一个问题是什么？",
      },
    ]);
  });

  test("applies favorite_node and unfavorite_node through the reducer", () => {
    let state = createInitialIdeaTreeState("agent-apply-fav", "一个模糊的方向");
    state = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "方向 A" }, { title: "方向 B" }],
      source: "ai",
    });
    const [a, b] = getActiveNodes(state).filter((node) => node.parentId === state.rootNodeId);
    const result = applyAgentResponseToIdeaTree(state, {
      message: "我把 A 标为收藏，把 B 取消收藏。",
      operations: [
        { type: "favorite_node", nodeId: a.id },
        { type: "unfavorite_node", nodeId: b.id, reason: "还不够明确" },
      ],
    });

    expect(result.state.nodes[a.id].favorited).toBe(true);
    expect(result.state.nodes[b.id].favorited).toBe(false);
    expect(result.appliedOperations).toEqual(["favorite_node"]);
    // unfavorite_node on a not-yet-favorited node is a no-op:
    expect(result.ignoredOperations).toEqual(["unfavorite_node"]);
  });

  test("keeps proposed node edits as suggestion cards instead of changing node text", () => {
    const state = createInitialIdeaTreeState("agent-apply-2", "一个模糊的活动主题");
    const response: BrainstormAgentResponse = {
      message: "这个根想法可以更短，但先给你一个建议。",
      operations: [
        {
          type: "propose_node_edit",
          nodeId: state.rootNodeId,
          title: "更清楚的活动主题",
          reason: "压短表达，方便继续发散。",
        },
      ],
    };

    const result = applyAgentResponseToIdeaTree(state, response);

    expect(result.state.nodes[state.rootNodeId].title).toBe("一个模糊的活动主题");
    expect(result.cards).toEqual([
      {
        type: "node_edit_suggestion",
        nodeId: state.rootNodeId,
        title: "更清楚的活动主题",
        description: undefined,
        reason: "压短表达，方便继续发散。",
      },
    ]);
  });

  test("keeps proposed node merges as suggestion cards instead of deleting nodes", () => {
    let state = createInitialIdeaTreeState("agent-apply-merge", "一个模糊的内容方向");
    state = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [
        { title: "给创作者整理灵感" },
        { title: "帮创作者收拢选题" },
      ],
      source: "ai",
    });
    const [first, second] = getActiveNodes(state).filter(
      (node) => node.parentId === state.rootNodeId,
    );
    const response: BrainstormAgentResponse = {
      message: "这两个节点接近，我先给合并建议。",
      operations: [
        {
          type: "propose_node_merge",
          nodeIds: [first.id, second.id],
          title: "创作者灵感收拢",
          description: "把整理灵感和收拢选题合成一个更明确的方向。",
          reason: "两个节点都在说帮创作者从零散想法走向更清楚的选题。",
        },
      ],
    };

    const result = applyAgentResponseToIdeaTree(state, response);

    expect(Object.values(result.state.nodes).map((node) => node.title)).toContain(
      "给创作者整理灵感",
    );
    expect(Object.values(result.state.nodes).map((node) => node.title)).toContain(
      "帮创作者收拢选题",
    );
    expect(result.cards).toEqual([
      {
        type: "node_merge_suggestion",
        nodeIds: [first.id, second.id],
        title: "创作者灵感收拢",
        description: "把整理灵感和收拢选题合成一个更明确的方向。",
        reason: "两个节点都在说帮创作者从零散想法走向更清楚的选题。",
      },
    ]);
    expect(result.appliedOperations).toEqual(["propose_node_merge"]);
  });

  test("does not let the agent grow from a parked node", () => {
    let state = createInitialIdeaTreeState("agent-apply-3", "一个模糊的研究方向");
    state = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "公开资料方向" }, { title: "深访方向" }],
      source: "ai",
    });
    const parked = getActiveNodes(state).find((node) => node.title === "公开资料方向");
    state = ideaTreeReducer(state, { type: "park_node", nodeId: parked!.id });

    const result = applyAgentResponseToIdeaTree(state, {
      message: "我不会主动绕回已放一边的方向。",
      operations: [
        {
          type: "create_nodes",
          parentNodeId: parked!.id,
          ideas: [{ title: "继续查资料" }],
        },
      ],
    });

    expect(Object.values(result.state.nodes).map((node) => node.title)).not.toContain(
      "继续查资料",
    );
    expect(result.ignoredOperations).toEqual(["create_nodes"]);
  });

  test("creates a clear version draft card when the agent summarizes after favorite + grow", () => {
    let state = createInitialIdeaTreeState("agent-apply-4", "一个模糊的创作方向");
    state = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "做成系列短片" }, { title: "做成互动网页" }],
      source: "ai",
    });
    const [videoNode, webNode] = getActiveNodes(state).filter(
      (node) => node.parentId === state.rootNodeId,
    );
    state = ideaTreeReducer(state, { type: "favorite_node", nodeId: webNode.id });
    state = ideaTreeReducer(state, { type: "park_node", nodeId: videoNode.id });

    const result = applyAgentResponseToIdeaTree(state, {
      message: "这一轮可以先收成一个清晰版本。",
      operations: [
        {
          type: "create_clear_version",
          summary: "这轮更清楚的是：先用互动网页承载创作方向。",
          favoritedTitles: [webNode.title],
          parked: [videoNode.title],
          uncertain: "还不确定互动密度。",
          nextThought: "继续拆三个核心互动。",
          html: "<section><h2>这一轮更清楚了</h2><p>先用互动网页承载创作方向。</p></section>",
        },
      ],
    });

    expect(result.state.clearVersions).toHaveLength(1);
    expect(result.cards).toEqual([
      {
        type: "clear_version_draft",
        summary: "这轮更清楚的是：先用互动网页承载创作方向。",
        favoritedTitles: [webNode.title],
        parked: [videoNode.title],
        uncertain: "还不确定互动密度。",
        nextThought: "继续拆三个核心互动。",
        html: "<section><h2>这一轮更清楚了</h2><p>先用互动网页承载创作方向。</p></section>",
      },
    ]);
  });
});
