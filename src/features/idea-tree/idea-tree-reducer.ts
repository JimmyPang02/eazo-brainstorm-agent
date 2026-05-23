export type IdeaNodeSource = "user" | "ai";
export type IdeaNodeStatus = "active" | "current" | "parked";

export type IdeaNode = {
  id: string;
  treeId: string;
  parentId: string | null;
  title: string;
  description?: string;
  source: IdeaNodeSource;
  status: IdeaNodeStatus;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
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
      type: "follow_direction";
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
      type: "create_clear_version";
      clearVersionId: string;
      createdAt: string;
    };

export type ClearVersion = {
  id: string;
  treeId: string;
  createdAt: string;
  summary: string;
  currentDirection: string;
  parked: string[];
  uncertain: string;
  nextThought: string;
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
  currentDirectionNodeId: string | null;
  nodes: Record<string, IdeaNode>;
  edges: Record<string, IdeaEdge>;
  basketNodeIds: string[];
  actions: BrainstormAction[];
  agentRuns: AgentRun[];
  clearVersions: ClearVersion[];
};

export type IdeaTreeReducerAction =
  | {
      type: "grow_from_node";
      nodeId: string;
      ideas: Array<{ title: string; description?: string }>;
      source: IdeaNodeSource;
    }
  | { type: "follow_direction"; nodeId: string }
  | { type: "park_node"; nodeId: string; reason?: string }
  | { type: "restore_node"; nodeId: string }
  | { type: "add_seed_thought"; title: string; description?: string }
  | { type: "replace_state"; state: IdeaTreeState }
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
      currentDirection: string;
      parked: string[];
      uncertain: string;
      nextThought: string;
    };

const ROOT_X = 480;
const ROOT_Y = 520;
const CHILD_Y_STEP = 176;
const CHILD_X_STEP = 260;

export function createInitialIdeaTreeState(treeId: string, title: string): IdeaTreeState {
  const now = new Date().toISOString();
  const rootNodeId = `${treeId}:root`;

  return {
    treeId,
    title,
    rootNodeId,
    focusedNodeId: rootNodeId,
    currentDirectionNodeId: null,
    basketNodeIds: [],
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
        description: "从这里开始发散、剪枝，并沿一条方向继续想清楚。",
        source: "user",
        status: "active",
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
      const createdNodes = reducerAction.ideas.map((idea, index) => {
        const childIndex = existingChildren.length + index;
        const offset = childIndex - (reducerAction.ideas.length - 1) / 2;
        const id = `${parent.id}:idea-${state.actions.length + 1}-${index + 1}`;

        return {
          id,
          treeId: state.treeId,
          parentId: parent.id,
          title: idea.title,
          description: idea.description,
          source: reducerAction.source,
          status: "active" as const,
          x: parent.x + offset * CHILD_X_STEP,
          y: parent.y - CHILD_Y_STEP,
          createdAt: now,
          updatedAt: now,
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

    case "follow_direction": {
      const node = state.nodes[reducerAction.nodeId];
      if (!node || node.status === "parked") return state;

      const now = new Date().toISOString();
      const nodes = Object.fromEntries(
        Object.values(state.nodes).map((item) => [
          item.id,
          {
            ...item,
            status:
              item.id === node.id
                ? ("current" as const)
                : item.status === "current"
                  ? ("active" as const)
                  : item.status,
            updatedAt: item.id === node.id ? now : item.updatedAt,
          },
        ]),
      );

      return {
        ...state,
        focusedNodeId: node.id,
        currentDirectionNodeId: node.id,
        nodes,
        actions: [
          ...state.actions,
          {
            id: nextActionId(state),
            treeId: state.treeId,
            type: "follow_direction",
            nodeId: node.id,
            createdAt: now,
          },
        ],
      };
    }

    case "park_node": {
      const node = state.nodes[reducerAction.nodeId];
      if (!node || node.id === state.rootNodeId) return state;

      const now = new Date().toISOString();
      return {
        ...state,
        currentDirectionNodeId:
          state.currentDirectionNodeId === node.id ? null : state.currentDirectionNodeId,
        focusedNodeId: node.parentId ?? state.rootNodeId,
        basketNodeIds: state.basketNodeIds.includes(node.id)
          ? state.basketNodeIds
          : [...state.basketNodeIds, node.id],
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
      if (!node) return state;

      const now = new Date().toISOString();
      return {
        ...state,
        focusedNodeId: node.id,
        basketNodeIds: state.basketNodeIds.filter((id) => id !== node.id),
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
      const targetNodeId = state.currentDirectionNodeId ?? state.focusedNodeId ?? state.rootNodeId;
      return ideaTreeReducer(state, {
        type: "grow_from_node",
        nodeId: targetNodeId,
        ideas: [{ title: reducerAction.title, description: reducerAction.description }],
        source: "user",
      });
    }

    case "replace_state": {
      return reducerAction.state;
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
          currentDirectionNodeId:
            state.currentDirectionNodeId && idsToRemove.has(state.currentDirectionNodeId)
              ? null
              : state.currentDirectionNodeId,
          basketNodeIds: state.basketNodeIds.filter((id) => !idsToRemove.has(id)),
        };
      }

      if (action.type === "park_node") {
        const node = state.nodes[action.nodeId];
        if (!node) return { ...state, actions };

        return {
          ...state,
          actions,
          focusedNodeId: node.id,
          basketNodeIds: state.basketNodeIds.filter((id) => id !== node.id),
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
          basketNodeIds: state.basketNodeIds.includes(node.id)
            ? state.basketNodeIds
            : [...state.basketNodeIds, node.id],
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

      if (action.type === "create_clear_version") {
        return {
          ...state,
          actions,
          clearVersions: state.clearVersions.filter((version) => version.id !== action.clearVersionId),
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
        currentDirection: reducerAction.currentDirection,
        parked: reducerAction.parked,
        uncertain: reducerAction.uncertain,
        nextThought: reducerAction.nextThought,
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
  return state.basketNodeIds
    .map((id) => state.nodes[id])
    .filter((node): node is IdeaNode => Boolean(node));
}

export function canGenerateClearVersion(state: IdeaTreeState): boolean {
  return Boolean(
    state.currentDirectionNodeId &&
      state.basketNodeIds.length > 0 &&
      state.actions.some((action) => action.type === "grow_from_node"),
  );
}

function nextActionId(state: IdeaTreeState): string {
  return `${state.treeId}:action-${state.actions.length + 1}`;
}
