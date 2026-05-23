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
  updatedAt: string;
};

type LegacyStoredIdeaTree = StoredIdeaTree & {
  currentDirectionNodeId?: string | null;
  basketNodeIds?: string[];
};

type LegacyIdeaNode = Omit<IdeaNode, "status" | "favorited"> & {
  status: IdeaNode["status"] | "current";
  favorited?: boolean;
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

export type StoredTreeSummary = {
  treeId: string;
  title: string;
  rootNodeId: string;
  updatedAt: string;
  nodeCount: number;
  maxLayer: number;
};

export async function listStoredTrees(
  db: IdeaTreeDatabase,
): Promise<StoredTreeSummary[]> {
  const trees = (await db.trees.toArray()) as LegacyStoredIdeaTree[];
  if (trees.length === 0) return [];

  const summaries = await Promise.all(
    trees.map(async (tree) => {
      const storedNodes = (await db.nodes
        .where("treeId")
        .equals(tree.treeId)
        .toArray()) as LegacyIdeaNode[];

      const maxLayer = computeMaxLayer(storedNodes, tree.rootNodeId);

      return {
        treeId: tree.treeId,
        title: tree.title,
        rootNodeId: tree.rootNodeId,
        updatedAt: tree.updatedAt,
        nodeCount: storedNodes.length,
        maxLayer,
      } satisfies StoredTreeSummary;
    }),
  );

  summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return summaries;
}

export async function createStoredTree(
  db: IdeaTreeDatabase,
  treeId: string,
  title = "",
): Promise<void> {
  const existing = await db.trees.get(treeId);
  if (existing) return;
  const now = new Date().toISOString();
  await db.trees.put({
    treeId,
    title,
    rootNodeId: `${treeId}:root`,
    focusedNodeId: `${treeId}:root`,
    updatedAt: now,
  });
}

export async function renameStoredTree(
  db: IdeaTreeDatabase,
  treeId: string,
  title: string,
): Promise<void> {
  const existing = (await db.trees.get(treeId)) as LegacyStoredIdeaTree | undefined;
  const now = new Date().toISOString();
  if (existing) {
    await db.trees.put({ ...existing, title, updatedAt: now });
  } else {
    await db.trees.put({
      treeId,
      title,
      rootNodeId: `${treeId}:root`,
      focusedNodeId: `${treeId}:root`,
      updatedAt: now,
    });
  }
}

function computeMaxLayer(nodes: LegacyIdeaNode[], rootNodeId: string): number {
  if (nodes.length === 0) return 0;
  const layerById = new Map<string, number>();
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = childrenByParent.get(node.parentId) ?? [];
    list.push(node.id);
    childrenByParent.set(node.parentId, list);
  }
  const queue: string[] = [rootNodeId];
  layerById.set(rootNodeId, 0);
  let max = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    const layer = layerById.get(id) ?? 0;
    if (layer > max) max = layer;
    const children = childrenByParent.get(id) ?? [];
    for (const childId of children) {
      if (layerById.has(childId)) continue;
      layerById.set(childId, layer + 1);
      queue.push(childId);
    }
  }
  return max;
}

export async function loadIdeaTreeState(
  db: IdeaTreeDatabase,
  treeId: string,
): Promise<IdeaTreeState | null> {
  const tree = (await db.trees.get(treeId)) as LegacyStoredIdeaTree | undefined;
  if (!tree) return null;

  const [storedNodes, edges, actions, agentRuns, clearVersions] = await Promise.all([
    db.nodes.where("treeId").equals(treeId).toArray() as Promise<LegacyIdeaNode[]>,
    db.edges.where("treeId").equals(treeId).toArray(),
    db.actions.where("treeId").equals(treeId).sortBy("createdAt") as Promise<
      Array<BrainstormAction | { type: string }>
    >,
    db.agentRuns.where("treeId").equals(treeId).sortBy("createdAt"),
    db.clearVersions.where("treeId").equals(treeId).sortBy("createdAt"),
  ]);

  const legacyBasket = new Set(tree.basketNodeIds ?? []);
  const nodes: IdeaNode[] = storedNodes.map((node) => ({
    ...node,
    status: node.status === "current" ? "active" : node.status,
    favorited: node.favorited ?? legacyBasket.has(node.id),
  }));

  const restoredEdges = edges.length > 0 ? edges : deriveIdeaEdgesFromNodes(treeId, nodes);
  const migratedActions = actions.filter((action): action is BrainstormAction =>
    KNOWN_ACTION_TYPES.has(action.type as BrainstormAction["type"]),
  );

  return {
    treeId: tree.treeId,
    title: tree.title,
    rootNodeId: tree.rootNodeId,
    focusedNodeId: tree.focusedNodeId,
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    edges: Object.fromEntries(restoredEdges.map((edge) => [edge.id, edge])),
    actions: migratedActions,
    agentRuns,
    clearVersions,
  };
}

const KNOWN_ACTION_TYPES = new Set<BrainstormAction["type"]>([
  "grow_from_node",
  "favorite_node",
  "unfavorite_node",
  "park_node",
  "restore_node",
  "add_seed_thought",
  "edit_node",
  "create_clear_version",
  "seed_root",
]);

export async function clearIdeaTreeState(
  db: IdeaTreeDatabase,
  treeId: string,
): Promise<void> {
  await db.transaction(
    "rw",
    [db.trees, db.nodes, db.edges, db.actions, db.agentRuns, db.clearVersions],
    async () => {
      await db.trees.where("treeId").equals(treeId).delete();
      await db.nodes.where("treeId").equals(treeId).delete();
      await db.edges.where("treeId").equals(treeId).delete();
      await db.actions.where("treeId").equals(treeId).delete();
      await db.agentRuns.where("treeId").equals(treeId).delete();
      await db.clearVersions.where("treeId").equals(treeId).delete();
    },
  );
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
