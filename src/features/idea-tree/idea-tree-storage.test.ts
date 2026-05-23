import { afterEach, describe, expect, test } from "bun:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import {
  createInitialIdeaTreeState,
  getActiveNodes,
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
  test("round-trips a tree with nodes, basket, actions, and clear versions", async () => {
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
    state = ideaTreeReducer(state, { type: "follow_direction", nodeId: natural.id });
    state = ideaTreeReducer(state, {
      type: "park_node",
      nodeId: utility.id,
      reason: "暂时太像工具名",
    });
    state = ideaTreeReducer(state, {
      type: "create_clear_version",
      summary: "这一轮更偏自然意象。",
      currentDirection: natural.title,
      parked: [utility.title],
      uncertain: "还不确定名字要不要更短。",
      nextThought: "继续长几个更轻的名字。",
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
    expect(loaded?.currentDirectionNodeId).toBe(natural.id);
    expect(loaded?.basketNodeIds).toEqual([utility.id]);
    expect(Object.values(loaded?.nodes ?? {}).map((node) => node.title)).toContain("偏自然意象");
    expect(loaded?.actions.map((action) => action.type)).toEqual([
      "grow_from_node",
      "follow_direction",
      "park_node",
      "create_clear_version",
    ]);
    expect(loaded?.agentRuns.at(-1)?.agentMessage).toBe("我补了两个方向。");
    expect(loaded?.clearVersions.at(-1)?.summary).toBe("这一轮更偏自然意象。");
  });
});
