import Dexie, { type DexieOptions, type Table } from "dexie";

import type {
  AgentRun,
  BrainstormAction,
  ClearVersion,
  IdeaNode,
  IdeaTreeState,
} from "./idea-tree-reducer";

type StoredIdeaTree = {
  treeId: string;
  title: string;
  rootNodeId: string;
  focusedNodeId: string;
  currentDirectionNodeId: string | null;
  basketNodeIds: string[];
  updatedAt: string;
};

export class IdeaTreeDatabase extends Dexie {
  trees!: Table<StoredIdeaTree, string>;
  nodes!: Table<IdeaNode, string>;
  actions!: Table<BrainstormAction, string>;
  agentRuns!: Table<AgentRun, string>;
  clearVersions!: Table<ClearVersion, string>;

  constructor(name = "eazo-brainstorm-idea-tree", options?: DexieOptions) {
    super(name, options);

    this.version(1).stores({
      trees: "treeId, updatedAt",
      nodes: "id, treeId, parentId, status, updatedAt",
      actions: "id, treeId, type, createdAt",
      clearVersions: "id, treeId, createdAt",
    });

    this.version(2).stores({
      trees: "treeId, updatedAt",
      nodes: "id, treeId, parentId, status, updatedAt",
      actions: "id, treeId, type, createdAt",
      agentRuns: "id, treeId, createdAt",
      clearVersions: "id, treeId, createdAt",
    });
  }
}

export function createIdeaTreeDb(name?: string, options?: DexieOptions): IdeaTreeDatabase {
  return new IdeaTreeDatabase(name, options);
}

export async function saveIdeaTreeState(
  db: IdeaTreeDatabase,
  state: IdeaTreeState,
): Promise<void> {
  const treeRecord: StoredIdeaTree = {
    treeId: state.treeId,
    title: state.title,
    rootNodeId: state.rootNodeId,
    focusedNodeId: state.focusedNodeId,
    currentDirectionNodeId: state.currentDirectionNodeId,
    basketNodeIds: state.basketNodeIds,
    updatedAt: new Date().toISOString(),
  };

  await db.transaction(
    "rw",
    [db.trees, db.nodes, db.actions, db.agentRuns, db.clearVersions],
    async () => {
      await db.trees.put(treeRecord);
      await replaceTreeRows(db.nodes, state.treeId, Object.values(state.nodes));
      await replaceTreeRows(db.actions, state.treeId, state.actions);
      await replaceTreeRows(db.agentRuns, state.treeId, state.agentRuns);
      await replaceTreeRows(db.clearVersions, state.treeId, state.clearVersions);
    },
  );
}

export async function loadIdeaTreeState(
  db: IdeaTreeDatabase,
  treeId: string,
): Promise<IdeaTreeState | null> {
  const tree = await db.trees.get(treeId);
  if (!tree) return null;

  const [nodes, actions, agentRuns, clearVersions] = await Promise.all([
    db.nodes.where("treeId").equals(treeId).toArray(),
    db.actions.where("treeId").equals(treeId).sortBy("createdAt"),
    db.agentRuns.where("treeId").equals(treeId).sortBy("createdAt"),
    db.clearVersions.where("treeId").equals(treeId).sortBy("createdAt"),
  ]);

  return {
    treeId: tree.treeId,
    title: tree.title,
    rootNodeId: tree.rootNodeId,
    focusedNodeId: tree.focusedNodeId,
    currentDirectionNodeId: tree.currentDirectionNodeId,
    basketNodeIds: tree.basketNodeIds,
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    actions,
    agentRuns,
    clearVersions,
  };
}

async function replaceTreeRows<T extends { id: string; treeId: string }>(
  table: Table<T, string>,
  treeId: string,
  rows: T[],
): Promise<void> {
  await table.where("treeId").equals(treeId).delete();
  if (rows.length > 0) {
    await table.bulkPut(rows);
  }
}
