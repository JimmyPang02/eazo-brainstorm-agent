import Dexie, { type DexieOptions, type Table } from "dexie";

import type {
  AgentRun,
  BrainstormAction,
  ClearVersion,
  IdeaEdge,
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
  edges!: Table<IdeaEdge, string>;
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

    this.version(3).stores({
      trees: "treeId, updatedAt",
      nodes: "id, treeId, parentId, status, updatedAt",
      edges: "id, treeId, parentNodeId, childNodeId, createdAt",
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
    [db.trees, db.nodes, db.edges, db.actions, db.agentRuns, db.clearVersions],
    async () => {
      await db.trees.put(treeRecord);
      await replaceTreeRows(db.nodes, state.treeId, Object.values(state.nodes));
      await replaceTreeRows(db.edges, state.treeId, Object.values(state.edges));
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

  const [nodes, edges, actions, agentRuns, clearVersions] = await Promise.all([
    db.nodes.where("treeId").equals(treeId).toArray(),
    db.edges.where("treeId").equals(treeId).toArray(),
    db.actions.where("treeId").equals(treeId).sortBy("createdAt"),
    db.agentRuns.where("treeId").equals(treeId).sortBy("createdAt"),
    db.clearVersions.where("treeId").equals(treeId).sortBy("createdAt"),
  ]);
  const restoredEdges = edges.length > 0 ? edges : deriveIdeaEdgesFromNodes(treeId, nodes);

  return {
    treeId: tree.treeId,
    title: tree.title,
    rootNodeId: tree.rootNodeId,
    focusedNodeId: tree.focusedNodeId,
    currentDirectionNodeId: tree.currentDirectionNodeId,
    basketNodeIds: tree.basketNodeIds,
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    edges: Object.fromEntries(restoredEdges.map((edge) => [edge.id, edge])),
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

function deriveIdeaEdgesFromNodes(treeId: string, nodes: IdeaNode[]): IdeaEdge[] {
  return nodes
    .filter((node) => node.parentId)
    .map((node) => ({
      id: `${node.id}:edge`,
      treeId,
      parentNodeId: node.parentId!,
      childNodeId: node.id,
      source: node.source,
      createdAt: node.createdAt,
    }));
}
