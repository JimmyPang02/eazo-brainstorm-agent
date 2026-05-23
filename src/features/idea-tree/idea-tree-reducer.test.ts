import { describe, expect, test } from "bun:test";

import {
  canGenerateClearVersion,
  createInitialIdeaTreeState,
  getActiveNodes,
  getFavoritedNodes,
  getIdeaEdges,
  getLayerByNodeId,
  getParkedNodes,
  ideaTreeReducer,
} from "./idea-tree-reducer";

describe("ideaTreeReducer", () => {
  test("grows child idea nodes from the focused node", () => {
    const state = createInitialIdeaTreeState("seed-1", "一个模糊的播客选题");

    const next = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [
        { title: "从嘉宾故事切入", description: "先找一个有强叙事的人物线" },
        { title: "从行业变化切入", description: "把趋势讲成一组可比较的观察" },
        { title: "从反常识问题切入", description: "用一个反直觉问题打开讨论" },
      ],
      source: "ai",
    });

    const children = getActiveNodes(next).filter((node) => node.parentId === state.rootNodeId);
    const edges = getIdeaEdges(next);
    expect(children).toHaveLength(3);
    expect(children.map((node) => node.title)).toEqual([
      "从嘉宾故事切入",
      "从行业变化切入",
      "从反常识问题切入",
    ]);
    expect(edges).toHaveLength(3);
    expect(edges.map((edge) => [edge.parentNodeId, edge.childNodeId])).toEqual(
      children.map((child) => [state.rootNodeId, child.id]),
    );
    expect(next.actions.at(-1)?.type).toBe("grow_from_node");
  });

  test("toggles favorited status with favorite_node and unfavorite_node", () => {
    const state = createInitialIdeaTreeState("seed-1", "一个模糊的活动主题");
    const grown = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "从线下互动开始" }],
      source: "ai",
    });
    const child = getActiveNodes(grown).find((node) => node.parentId === state.rootNodeId);

    const favorited = ideaTreeReducer(grown, {
      type: "favorite_node",
      nodeId: child!.id,
    });
    expect(favorited.nodes[child!.id].favorited).toBe(true);
    expect(getFavoritedNodes(favorited).map((n) => n.id)).toEqual([child!.id]);
    expect(favorited.actions.at(-1)?.type).toBe("favorite_node");

    const unfavorited = ideaTreeReducer(favorited, {
      type: "unfavorite_node",
      nodeId: child!.id,
    });
    expect(unfavorited.nodes[child!.id].favorited).toBe(false);
    expect(getFavoritedNodes(unfavorited)).toHaveLength(0);
    expect(unfavorited.actions.at(-1)?.type).toBe("unfavorite_node");
  });

  test("parks a node without adding it to a basket or losing focus", () => {
    const state = createInitialIdeaTreeState("seed-1", "一个模糊的创作方向");
    const grown = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "做成短视频栏目" }, { title: "做成互动网页" }],
      source: "ai",
    });
    const nodeToPark = getActiveNodes(grown).find((node) => node.title === "做成短视频栏目");

    const next = ideaTreeReducer(grown, {
      type: "park_node",
      nodeId: nodeToPark!.id,
      reason: "暂时不像当前想法",
    });

    expect(getParkedNodes(next).map((node) => node.title)).toEqual(["做成短视频栏目"]);
    expect(getActiveNodes(next).map((node) => node.title)).not.toContain("做成短视频栏目");
    expect(next.nodes[nodeToPark!.id].status).toBe("parked");
    expect(next.actions.at(-1)).toMatchObject({
      type: "park_node",
      nodeId: nodeToPark!.id,
      reason: "暂时不像当前想法",
    });
  });

  test("does not allow parking the root node", () => {
    const state = createInitialIdeaTreeState("seed-1", "一个模糊的方向");
    const next = ideaTreeReducer(state, {
      type: "park_node",
      nodeId: state.rootNodeId,
    });
    expect(next).toBe(state);
  });

  test("only allows a clear version after at least one growth and one favorite", () => {
    const state = createInitialIdeaTreeState("seed-1", "一个模糊的研究问题");
    expect(canGenerateClearVersion(state)).toBe(false);

    const grown = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "从用户访谈开始" }, { title: "从公开资料开始" }],
      source: "ai",
    });
    expect(canGenerateClearVersion(grown)).toBe(false);

    const [first] = getActiveNodes(grown).filter((node) => node.parentId === state.rootNodeId);
    const favorited = ideaTreeReducer(grown, {
      type: "favorite_node",
      nodeId: first.id,
    });
    expect(canGenerateClearVersion(favorited)).toBe(true);
  });

  test("replaces state when a saved local tree is loaded", () => {
    const state = createInitialIdeaTreeState("seed-1", "旧想法");
    const saved = createInitialIdeaTreeState("seed-2", "从本地 DB 读出的想法");

    const next = ideaTreeReducer(state, {
      type: "replace_state",
      state: saved,
    });

    expect(next.treeId).toBe("seed-2");
    expect(next.title).toBe("从本地 DB 读出的想法");
    expect(next.rootNodeId).toBe("seed-2:root");
  });

  test("undoes the most recent AI growth by removing its created nodes", () => {
    const state = createInitialIdeaTreeState("seed-1", "一个模糊的命名方向");
    const grown = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "自然意象" }, { title: "工具感" }],
      source: "ai",
    });

    const undone = ideaTreeReducer(grown, { type: "undo_last_action" });

    expect(Object.values(undone.nodes).map((node) => node.title)).not.toContain("自然意象");
    expect(Object.values(undone.nodes).map((node) => node.title)).not.toContain("工具感");
    expect(getIdeaEdges(undone)).toHaveLength(0);
    expect(undone.actions).toHaveLength(0);
    expect(undone.focusedNodeId).toBe(state.rootNodeId);
  });

  test("undoes parking by flipping the status back to active", () => {
    let state = createInitialIdeaTreeState("seed-1", "一个模糊的活动主题");
    state = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "线下互动" }],
      source: "ai",
    });
    const child = getActiveNodes(state).find((node) => node.title === "线下互动");
    state = ideaTreeReducer(state, { type: "park_node", nodeId: child!.id });

    const undone = ideaTreeReducer(state, { type: "undo_last_action" });

    expect(undone.nodes[child!.id].status).toBe("active");
    expect(undone.actions.at(-1)?.type).toBe("grow_from_node");
  });

  test("undoes favorite by flipping favorited back to false", () => {
    let state = createInitialIdeaTreeState("seed-1", "一个模糊的方向");
    state = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "线下互动" }],
      source: "ai",
    });
    const child = getActiveNodes(state).find((node) => node.title === "线下互动");
    state = ideaTreeReducer(state, { type: "favorite_node", nodeId: child!.id });
    expect(state.nodes[child!.id].favorited).toBe(true);

    const undone = ideaTreeReducer(state, { type: "undo_last_action" });
    expect(undone.nodes[child!.id].favorited).toBe(false);
    expect(undone.actions.at(-1)?.type).toBe("grow_from_node");
  });

  test("edits a node only through an explicit action and supports undo", () => {
    const state = createInitialIdeaTreeState("seed-1", "一个模糊的命名方向");

    const edited = ideaTreeReducer(state, {
      type: "edit_node",
      nodeId: state.rootNodeId,
      title: "更清楚的命名方向",
      description: "先用更短的表达继续发散。",
    });

    expect(edited.title).toBe("更清楚的命名方向");
    expect(edited.nodes[state.rootNodeId]).toMatchObject({
      title: "更清楚的命名方向",
      description: "先用更短的表达继续发散。",
    });
    expect(edited.actions.at(-1)).toMatchObject({
      type: "edit_node",
      nodeId: state.rootNodeId,
      previousTitle: "一个模糊的命名方向",
      previousDescription: "从这里开始发散、收藏、放一边，多条方向可以并行长下去。",
      nextTitle: "更清楚的命名方向",
      nextDescription: "先用更短的表达继续发散。",
    });

    const undone = ideaTreeReducer(edited, { type: "undo_last_action" });

    expect(undone.title).toBe("一个模糊的命名方向");
    expect(undone.nodes[state.rootNodeId]).toMatchObject({
      title: "一个模糊的命名方向",
      description: "从这里开始发散、收藏、放一边，多条方向可以并行长下去。",
    });
    expect(undone.actions).toHaveLength(0);
  });

  test("computes node layer depth via getLayerByNodeId", () => {
    const state = createInitialIdeaTreeState("seed-1", "根想法");
    const grown = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "子-1" }],
      source: "ai",
    });
    const child = getActiveNodes(grown).find((node) => node.title === "子-1")!;
    const grandgrown = ideaTreeReducer(grown, {
      type: "grow_from_node",
      nodeId: child.id,
      ideas: [{ title: "孙-1" }],
      source: "ai",
    });
    const grandchild = getActiveNodes(grandgrown).find((node) => node.title === "孙-1")!;

    const layers = getLayerByNodeId(grandgrown);
    expect(layers.get(state.rootNodeId)).toBe(0);
    expect(layers.get(child.id)).toBe(1);
    expect(layers.get(grandchild.id)).toBe(2);
  });

  test("records an agent run separately from user-visible brainstorm actions", () => {
    const state = createInitialIdeaTreeState("seed-1", "一个模糊的研究方向");

    const next = ideaTreeReducer(state, {
      type: "record_agent_run",
      userMessage: "继续帮我想",
      agentMessage: "我先长出三个方向。",
      operationTypes: ["create_nodes"],
      appliedOperationTypes: ["create_nodes"],
      ignoredOperationTypes: [],
    });

    expect(next.agentRuns).toHaveLength(1);
    expect(next.agentRuns[0]).toMatchObject({
      treeId: state.treeId,
      userMessage: "继续帮我想",
      agentMessage: "我先长出三个方向。",
      operationTypes: ["create_nodes"],
      appliedOperationTypes: ["create_nodes"],
      ignoredOperationTypes: [],
    });
    expect(next.actions).toHaveLength(0);
  });
});
