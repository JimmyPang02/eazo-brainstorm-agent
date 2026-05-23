export type IdeaNodeSource = "user" | "ai";
export type IdeaNodeStatus = "active" | "parked";

export type IdeaNodeQuickActionPrompts = {
  shift_angle: string;
  find_counterexample: string;
  find_similar_cases: string;
  synthesize_direction: string;
};

export type IdeaNode = {
  id: string;
  treeId: string;
  parentId: string | null;
  title: string;
  description?: string;
  source: IdeaNodeSource;
  status: IdeaNodeStatus;
  favorited: boolean;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
  quickActionPrompts?: IdeaNodeQuickActionPrompts;
};

export type IdeaEdge = {
  id: string;
  treeId: string;
  parentNodeId: string;
  childNodeId: string;
  source: IdeaNodeSource;
  createdAt: string;
};

export type BrainstormAction =
  | {
      id: string;
      treeId: string;
      type: "grow_from_node";
      nodeId: string;
      createdNodeIds: string[];
      source: IdeaNodeSource;
      createdAt: string;
    }
  | {
      id: string;
      treeId: string;
      type: "favorite_node";
      nodeId: string;
      createdAt: string;
    }
  | {
      id: string;
      treeId: string;
      type: "unfavorite_node";
      nodeId: string;
      createdAt: string;
    }
  | {
      id: string;
      treeId: string;
      type: "park_node";
      nodeId: string;
      reason?: string;
      createdAt: string;
    }
  | {
      id: string;
      treeId: string;
      type: "restore_node";
      nodeId: string;
      createdAt: string;
    }
  | {
      id: string;
      treeId: string;
      type: "add_seed_thought";
      nodeId: string;
      createdAt: string;
    }
  | {
      id: string;
      treeId: string;
      type: "edit_node";
      nodeId: string;
      previousTitle: string;
      previousDescription?: string;
      nextTitle: string;
      nextDescription?: string;
      createdAt: string;
    }
  | {
      id: string;
      treeId: string;
      type: "create_clear_version";
      clearVersionId: string;
      createdAt: string;
    }
  | {
      id: string;
      treeId: string;
      type: "seed_root";
      nodeId: string;
      title: string;
      createdAt: string;
    };

export type ClearVersion = {
  id: string;
  treeId: string;
  createdAt: string;
  summary: string;
  favoritedTitles: string[];
  parked: string[];
  uncertain: string;
  nextThought: string;
  html: string;
};

export type AgentRun = {
  id: string;
  treeId: string;
  createdAt: string;
  userMessage: string;
  agentMessage: string;
  operationTypes: string[];
  appliedOperationTypes: string[];
  ignoredOperationTypes: string[];
};

export type IdeaTreeState = {
  treeId: string;
  title: string;
  rootNodeId: string;
  focusedNodeId: string;
  nodes: Record<string, IdeaNode>;
  edges: Record<string, IdeaEdge>;
  actions: BrainstormAction[];
  agentRuns: AgentRun[];
  clearVersions: ClearVersion[];
};

export type IdeaTreeReducerAction =
  | {
      type: "grow_from_node";
      nodeId: string;
      ideas: Array<{
        title: string;
        description?: string;
        quickActionPrompts?: IdeaNodeQuickActionPrompts;
      }>;
      source: IdeaNodeSource;
    }
  | { type: "favorite_node"; nodeId: string }
  | { type: "unfavorite_node"; nodeId: string }
  | { type: "park_node"; nodeId: string; reason?: string }
  | { type: "restore_node"; nodeId: string }
  | { type: "add_seed_thought"; title: string; description?: string }
  | { type: "edit_node"; nodeId: string; title?: string; description?: string }
  | { type: "move_node"; nodeId: string; x: number; y: number }
  | { type: "seed_root"; title: string; description?: string }
  | { type: "replace_state"; state: IdeaTreeState }
  | { type: "rename_tree"; title: string }
  | { type: "undo_last_action" }
  | {
      type: "record_agent_run";
      userMessage: string;
      agentMessage: string;
      operationTypes: string[];
      appliedOperationTypes: string[];
      ignoredOperationTypes: string[];
    }
  | {
      type: "create_clear_version";
      summary: string;
      favoritedTitles: string[];
      parked: string[];
      uncertain: string;
      nextThought: string;
      html: string;
    };

const ROOT_X = 700;
const ROOT_Y = 920;
const CHILD_Y_STEP = 200;
// Card is 260px wide. Step must clear that plus a visual gap so siblings never
// collapse onto each other. Wider trees just claim more horizontal room — the
// canvas is pan/zoomable, so spreading wins over self-overlap.
const CHILD_X_STEP = 320;

export function createEmptyIdeaTreeState(treeId: string): IdeaTreeState {
  const rootNodeId = `${treeId}:root`;

  return {
    treeId,
    title: "",
    rootNodeId,
    focusedNodeId: rootNodeId,
    actions: [],
    agentRuns: [],
    clearVersions: [],
    edges: {},
    nodes: {},
  };
}

export function hasRoot(state: IdeaTreeState): boolean {
  return Boolean(state.nodes[state.rootNodeId]);
}

export function createInitialIdeaTreeState(treeId: string, title: string): IdeaTreeState {
  const now = new Date().toISOString();
  const rootNodeId = `${treeId}:root`;

  return {
    treeId,
    title,
    rootNodeId,
    focusedNodeId: rootNodeId,
    actions: [],
    agentRuns: [],
    clearVersions: [],
    edges: {},
    nodes: {
      [rootNodeId]: {
        id: rootNodeId,
        treeId,
        parentId: null,
        title,
        description: "从这里开始发散、收藏、放一边，多条方向可以并行长下去。",
        source: "user",
        status: "active",
        favorited: false,
        x: ROOT_X,
        y: ROOT_Y,
        createdAt: now,
        updatedAt: now,
      },
    },
  };
}

export function ideaTreeReducer(
  state: IdeaTreeState,
  reducerAction: IdeaTreeReducerAction,
): IdeaTreeState {
  switch (reducerAction.type) {
    case "grow_from_node": {
      const parent = state.nodes[reducerAction.nodeId];
      if (!parent || parent.status === "parked") return state;

      const now = new Date().toISOString();
      const existingChildren = Object.values(state.nodes).filter(
        (node) => node.parentId === parent.id,
      );
      const totalChildren = existingChildren.length + reducerAction.ideas.length;
      const offsets = computeChildXOffsets(parent, totalChildren);

      const repositionedExisting = existingChildren.map((node, index) => ({
        ...node,
        x: parent.x + offsets[index],
        updatedAt: now,
      }));

      const createdNodes = reducerAction.ideas.map((idea, index) => {
        const siblingIndex = existingChildren.length + index;
        const id = `${parent.id}:idea-${state.actions.length + 1}-${index + 1}`;

        return {
          id,
          treeId: state.treeId,
          parentId: parent.id,
          title: idea.title,
          description: idea.description,
          source: reducerAction.source,
          status: "active" as const,
          favorited: false,
          x: parent.x + offsets[siblingIndex],
          y: parent.y - CHILD_Y_STEP,
          createdAt: now,
          updatedAt: now,
          quickActionPrompts: idea.quickActionPrompts,
        };
      });
      const createdEdges = createdNodes.map((node) => ({
        id: `${node.id}:edge`,
        treeId: state.treeId,
        parentNodeId: parent.id,
        childNodeId: node.id,
        source: reducerAction.source,
        createdAt: now,
      }));

      return {
        ...state,
        focusedNodeId: createdNodes[0]?.id ?? state.focusedNodeId,
        nodes: {
          ...state.nodes,
          ...Object.fromEntries(repositionedExisting.map((node) => [node.id, node])),
          ...Object.fromEntries(createdNodes.map((node) => [node.id, node])),
        },
        edges: {
          ...state.edges,
          ...Object.fromEntries(createdEdges.map((edge) => [edge.id, edge])),
        },
        actions: [
          ...state.actions,
          {
            id: nextActionId(state),
            treeId: state.treeId,
            type: "grow_from_node",
            nodeId: parent.id,
            createdNodeIds: createdNodes.map((node) => node.id),
            source: reducerAction.source,
            createdAt: now,
          },
        ],
      };
    }

    case "seed_root": {
      if (state.nodes[state.rootNodeId]) return state;
      const title = reducerAction.title.trim();
      if (!title) return state;

      const now = new Date().toISOString();
      const rootNode: IdeaNode = {
        id: state.rootNodeId,
        treeId: state.treeId,
        parentId: null,
        title,
        description: reducerAction.description?.trim() || undefined,
        source: "user",
        status: "active",
        favorited: false,
        x: ROOT_X,
        y: ROOT_Y,
        createdAt: now,
        updatedAt: now,
      };

      return {
        ...state,
        title,
        focusedNodeId: state.rootNodeId,
        nodes: { [state.rootNodeId]: rootNode },
        actions: [
          ...state.actions,
          {
            id: nextActionId(state),
            treeId: state.treeId,
            type: "seed_root",
            nodeId: state.rootNodeId,
            title,
            createdAt: now,
          },
        ],
      };
    }

    case "favorite_node": {
      const node = state.nodes[reducerAction.nodeId];
      if (!node || node.favorited) return state;

      const now = new Date().toISOString();
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [node.id]: { ...node, favorited: true, updatedAt: now },
        },
        actions: [
          ...state.actions,
          {
            id: nextActionId(state),
            treeId: state.treeId,
            type: "favorite_node",
            nodeId: node.id,
            createdAt: now,
          },
        ],
      };
    }

    case "unfavorite_node": {
      const node = state.nodes[reducerAction.nodeId];
      if (!node || !node.favorited) return state;

      const now = new Date().toISOString();
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [node.id]: { ...node, favorited: false, updatedAt: now },
        },
        actions: [
          ...state.actions,
          {
            id: nextActionId(state),
            treeId: state.treeId,
            type: "unfavorite_node",
            nodeId: node.id,
            createdAt: now,
          },
        ],
      };
    }

    case "park_node": {
      const node = state.nodes[reducerAction.nodeId];
      if (!node || node.id === state.rootNodeId) return state;
      if (node.status === "parked") return state;

      const now = new Date().toISOString();
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [node.id]: {
            ...node,
            status: "parked",
            updatedAt: now,
          },
        },
        actions: [
          ...state.actions,
          {
            id: nextActionId(state),
            treeId: state.treeId,
            type: "park_node",
            nodeId: node.id,
            reason: reducerAction.reason,
            createdAt: now,
          },
        ],
      };
    }

    case "restore_node": {
      const node = state.nodes[reducerAction.nodeId];
      if (!node || node.status === "active") return state;

      const now = new Date().toISOString();
      return {
        ...state,
        focusedNodeId: node.id,
        nodes: {
          ...state.nodes,
          [node.id]: {
            ...node,
            status: "active",
            updatedAt: now,
          },
        },
        actions: [
          ...state.actions,
          {
            id: nextActionId(state),
            treeId: state.treeId,
            type: "restore_node",
            nodeId: node.id,
            createdAt: now,
          },
        ],
      };
    }

    case "add_seed_thought": {
      const targetNodeId = state.focusedNodeId ?? state.rootNodeId;
      return ideaTreeReducer(state, {
        type: "grow_from_node",
        nodeId: targetNodeId,
        ideas: [{ title: reducerAction.title, description: reducerAction.description }],
        source: "user",
      });
    }

    case "edit_node": {
      const node = state.nodes[reducerAction.nodeId];
      if (!node) return state;

      const now = new Date().toISOString();
      const nextTitle = reducerAction.title?.trim() || node.title;
      const nextDescription =
        reducerAction.description === undefined ? node.description : reducerAction.description;

      if (nextTitle === node.title && nextDescription === node.description) {
        return state;
      }

      return {
        ...state,
        title: node.id === state.rootNodeId ? nextTitle : state.title,
        nodes: {
          ...state.nodes,
          [node.id]: {
            ...node,
            title: nextTitle,
            description: nextDescription,
            updatedAt: now,
          },
        },
        actions: [
          ...state.actions,
          {
            id: nextActionId(state),
            treeId: state.treeId,
            type: "edit_node",
            nodeId: node.id,
            previousTitle: node.title,
            previousDescription: node.description,
            nextTitle,
            nextDescription,
            createdAt: now,
          },
        ],
      };
    }

    case "replace_state": {
      return reducerAction.state;
    }

    case "rename_tree": {
      const next = reducerAction.title.trim();
      if (next === state.title) return state;
      return { ...state, title: next };
    }

    case "move_node": {
      const node = state.nodes[reducerAction.nodeId];
      if (!node) return state;
      if (node.x === reducerAction.x && node.y === reducerAction.y) return state;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [node.id]: {
            ...node,
            x: reducerAction.x,
            y: reducerAction.y,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }

    case "undo_last_action": {
      const action = state.actions.at(-1);
      if (!action) return state;

      const actions = state.actions.slice(0, -1);

      if (action.type === "grow_from_node") {
        const idsToRemove = new Set(action.createdNodeIds);
        for (const node of Object.values(state.nodes)) {
          if (node.parentId && idsToRemove.has(node.parentId)) {
            idsToRemove.add(node.id);
          }
        }

        const nodes = Object.fromEntries(
          Object.entries(state.nodes).filter(([id]) => !idsToRemove.has(id)),
        );
        const edges = Object.fromEntries(
          Object.entries(state.edges).filter(
            ([, edge]) =>
              !idsToRemove.has(edge.parentNodeId) && !idsToRemove.has(edge.childNodeId),
          ),
        );
        return {
          ...state,
          nodes,
          edges,
          actions,
          focusedNodeId: action.nodeId,
        };
      }

      if (action.type === "favorite_node") {
        const node = state.nodes[action.nodeId];
        if (!node) return { ...state, actions };
        return {
          ...state,
          actions,
          nodes: {
            ...state.nodes,
            [node.id]: { ...node, favorited: false, updatedAt: new Date().toISOString() },
          },
        };
      }

      if (action.type === "unfavorite_node") {
        const node = state.nodes[action.nodeId];
        if (!node) return { ...state, actions };
        return {
          ...state,
          actions,
          nodes: {
            ...state.nodes,
            [node.id]: { ...node, favorited: true, updatedAt: new Date().toISOString() },
          },
        };
      }

      if (action.type === "park_node") {
        const node = state.nodes[action.nodeId];
        if (!node) return { ...state, actions };

        return {
          ...state,
          actions,
          focusedNodeId: node.id,
          nodes: {
            ...state.nodes,
            [node.id]: {
              ...node,
              status: "active",
              updatedAt: new Date().toISOString(),
            },
          },
        };
      }

      if (action.type === "restore_node") {
        const node = state.nodes[action.nodeId];
        if (!node) return { ...state, actions };

        return {
          ...state,
          actions,
          focusedNodeId: node.parentId ?? state.rootNodeId,
          nodes: {
            ...state.nodes,
            [node.id]: {
              ...node,
              status: "parked",
              updatedAt: new Date().toISOString(),
            },
          },
        };
      }

      if (action.type === "edit_node") {
        const node = state.nodes[action.nodeId];
        if (!node) return { ...state, actions };

        return {
          ...state,
          title: node.id === state.rootNodeId ? action.previousTitle : state.title,
          actions,
          nodes: {
            ...state.nodes,
            [node.id]: {
              ...node,
              title: action.previousTitle,
              description: action.previousDescription,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      }

      if (action.type === "create_clear_version") {
        return {
          ...state,
          actions,
          clearVersions: state.clearVersions.filter((version) => version.id !== action.clearVersionId),
        };
      }

      if (action.type === "seed_root") {
        return {
          ...state,
          actions,
          title: "",
          focusedNodeId: state.rootNodeId,
          nodes: {},
          edges: {},
        };
      }

      return {
        ...state,
        actions,
      };
    }

    case "record_agent_run": {
      const now = new Date().toISOString();
      return {
        ...state,
        agentRuns: [
          ...state.agentRuns,
          {
            id: `${state.treeId}:agent-run-${state.agentRuns.length + 1}`,
            treeId: state.treeId,
            createdAt: now,
            userMessage: reducerAction.userMessage,
            agentMessage: reducerAction.agentMessage,
            operationTypes: reducerAction.operationTypes,
            appliedOperationTypes: reducerAction.appliedOperationTypes,
            ignoredOperationTypes: reducerAction.ignoredOperationTypes,
          },
        ],
      };
    }

    case "create_clear_version": {
      const now = new Date().toISOString();
      const clearVersion: ClearVersion = {
        id: `${state.treeId}:clear-${state.clearVersions.length + 1}`,
        treeId: state.treeId,
        createdAt: now,
        summary: reducerAction.summary,
        favoritedTitles: reducerAction.favoritedTitles,
        parked: reducerAction.parked,
        uncertain: reducerAction.uncertain,
        nextThought: reducerAction.nextThought,
        html: reducerAction.html,
      };

      return {
        ...state,
        clearVersions: [...state.clearVersions, clearVersion],
        actions: [
          ...state.actions,
          {
            id: nextActionId(state),
            treeId: state.treeId,
            type: "create_clear_version",
            clearVersionId: clearVersion.id,
            createdAt: now,
          },
        ],
      };
    }
  }
}

export function getActiveNodes(state: IdeaTreeState): IdeaNode[] {
  return Object.values(state.nodes).filter((node) => node.status !== "parked");
}

export function getIdeaEdges(state: IdeaTreeState): IdeaEdge[] {
  return Object.values(state.edges);
}

export function getParkedNodes(state: IdeaTreeState): IdeaNode[] {
  return Object.values(state.nodes).filter((node) => node.status === "parked");
}

export function getFavoritedNodes(state: IdeaTreeState): IdeaNode[] {
  return Object.values(state.nodes).filter((node) => node.favorited);
}

export function canGenerateClearVersion(state: IdeaTreeState): boolean {
  return (
    state.actions.some((action) => action.type === "grow_from_node") &&
    Object.values(state.nodes).some((node) => node.favorited)
  );
}

export function getLayerByNodeId(state: IdeaTreeState): Map<string, number> {
  const layers = new Map<string, number>();
  const nodes = state.nodes;

  function layerFor(id: string): number {
    const cached = layers.get(id);
    if (cached !== undefined) return cached;
    const node = nodes[id];
    if (!node || !node.parentId) {
      layers.set(id, 0);
      return 0;
    }
    const value = layerFor(node.parentId) + 1;
    layers.set(id, value);
    return value;
  }

  for (const id of Object.keys(nodes)) {
    layerFor(id);
  }
  return layers;
}

function nextActionId(state: IdeaTreeState): string {
  return `${state.treeId}:action-${state.actions.length + 1}`;
}

export function computeChildXOffsets(
  parent: IdeaNode,
  totalChildren: number,
): number[] {
  if (totalChildren <= 0) return [];
  if (totalChildren === 1) return [0];

  const step = CHILD_X_STEP;
  const start = -((totalChildren - 1) / 2) * step;
  return Array.from({ length: totalChildren }, (_, i) => start + i * step);
}
