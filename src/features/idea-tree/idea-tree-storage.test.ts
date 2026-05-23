import { afterEach, describe, expect, test } from "bun:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import {
  createInitialIdeaTreeState,
  getActiveNodes,
  getFavoritedNodes,
  getIdeaEdges,
  getParkedNodes,
  ideaTreeReducer,
} from "./idea-tree-reducer";
import {
  createIdeaTreeDb,
  loadIdeaTreeState,
  saveIdeaTreeState,
  type IdeaTreeDatabase,
} from "./idea-tree-storage";

let db: IdeaTreeDatabase | null = null;

afterEach(async () => {
  if (db) {
    await db.delete();
    db = null;
  }
});

describe("idea tree IndexedDB storage", () => {
  test("round-trips a tree with nodes, favorited flags, parked nodes, actions, and clear versions", async () => {
    db = createIdeaTreeDb(`idea-tree-test-${crypto.randomUUID()}`, {
      IDBKeyRange,
      indexedDB,
    });
    let state = createInitialIdeaTreeState("tree-storage-1", "一个模糊的命名方向");
    state = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: state.rootNodeId,
      ideas: [{ title: "偏自然意象" }, { title: "偏工具感" }],
      source: "ai",
    });

    const [natural, utility] = getActiveNodes(state).filter(
      (node) => node.parentId === state.rootNodeId,
    );
    state = ideaTreeReducer(state, { type: "favorite_node", nodeId: natural.id });
    state = ideaTreeReducer(state, {
      type: "park_node",
      nodeId: utility.id,
      reason: "暂时太像工具名",
    });
    state = ideaTreeReducer(state, {
      type: "create_clear_version",
      summary: "这一轮更偏自然意象。",
      favoritedTitles: [natural.title],
      parked: [utility.title],
      uncertain: "还不确定名字要不要更短。",
      nextThought: "继续长几个更轻的名字。",
      html: "<section><h2>更偏自然意象</h2><p>命名方向逐渐清楚。</p></section>",
    });
    state = ideaTreeReducer(state, {
      type: "record_agent_run",
      userMessage: "继续长几个名字",
      agentMessage: "我补了两个方向。",
      operationTypes: ["create_nodes"],
      appliedOperationTypes: ["create_nodes"],
      ignoredOperationTypes: [],
    });

    await saveIdeaTreeState(db, state);

    const loaded = await loadIdeaTreeState(db, state.treeId);
    expect(loaded?.treeId).toBe(state.treeId);
    expect(getFavoritedNodes(loaded!).map((node) => node.id)).toEqual([natural.id]);
    expect(getParkedNodes(loaded!).map((node) => node.id)).toEqual([utility.id]);
    expect(Object.values(loaded?.nodes ?? {}).map((node) => node.title)).toContain("偏自然意象");
    expect(getIdeaEdges(loaded!).map((edge) => [edge.parentNodeId, edge.childNodeId])).toEqual(
      getIdeaEdges(state).map((edge) => [edge.parentNodeId, edge.childNodeId]),
    );
    expect(loaded?.actions.map((action) => action.type)).toEqual([
      "grow_from_node",
      "favorite_node",
      "park_node",
      "create_clear_version",
    ]);
    expect(loaded?.agentRuns.at(-1)?.agentMessage).toBe("我补了两个方向。");
    expect(loaded?.clearVersions.at(-1)?.summary).toBe("这一轮更偏自然意象。");
    expect(loaded?.clearVersions.at(-1)?.favoritedTitles).toEqual([natural.title]);
  });

  test("loads legacy rows (basketNodeIds + status='current') with defensive coercion", async () => {
    db = createIdeaTreeDb(`idea-tree-legacy-${crypto.randomUUID()}`, {
      IDBKeyRange,
      indexedDB,
    });
    const treeId = "tree-legacy-1";
    const now = new Date().toISOString();
    const rootId = `${treeId}:root`;
    const childId = `${treeId}:child`;
    const parkedId = `${treeId}:parked`;

    // Write legacy-shaped rows directly to the underlying tables.
    await db.trees.put({
      treeId,
      title: "legacy",
      rootNodeId: rootId,
      focusedNodeId: childId,
      // legacy fields — should be discarded / folded in.
      currentDirectionNodeId: childId,
      basketNodeIds: [parkedId],
      updatedAt: now,
    } as never);
    await db.nodes.bulkPut([
      {
        id: rootId,
        treeId,
        parentId: null,
        title: "legacy root",
        source: "user",
        status: "active",
        x: 0,
        y: 0,
        createdAt: now,
        updatedAt: now,
      } as never,
      {
        id: childId,
        treeId,
        parentId: rootId,
        title: "legacy current",
        source: "ai",
        status: "current", // legacy status value
        x: 0,
        y: 0,
        createdAt: now,
        updatedAt: now,
      } as never,
      {
        id: parkedId,
        treeId,
        parentId: rootId,
        title: "legacy parked",
        source: "ai",
        status: "parked",
        x: 0,
        y: 0,
        createdAt: now,
        updatedAt: now,
      } as never,
    ]);

    const loaded = await loadIdeaTreeState(db, treeId);
    expect(loaded).not.toBeNull();
    expect(loaded?.nodes[childId].status).toBe("active");
    expect(loaded?.nodes[childId].favorited).toBe(false);
    // basketNodeIds is folded into favorited=true on each listed node:
    expect(loaded?.nodes[parkedId].favorited).toBe(true);
    // currentDirectionNodeId is discarded — type no longer exposes it:
    expect((loaded as unknown as { currentDirectionNodeId?: unknown }).currentDirectionNodeId).toBeUndefined();
  });
});
