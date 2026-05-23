import type { BrainstormAgentResponse } from "./agent-operations";
import {
  canGenerateClearVersion,
  ideaTreeReducer,
  type IdeaTreeState,
} from "./idea-tree-reducer";

export type AgentContextCard =
  | {
      type: "followup";
      nodeId: string;
      question: string;
    }
  | {
      type: "node_edit_suggestion";
      nodeId: string;
      title?: string;
      description?: string;
      reason: string;
    }
  | {
      type: "node_merge_suggestion";
      nodeIds: string[];
      title: string;
      description: string;
      reason: string;
    }
  | {
      type: "clear_version_draft";
      summary: string;
      currentDirection: string;
      parked: string[];
      uncertain: string;
      nextThought: string;
    };

export type ApplyAgentResponseResult = {
  state: IdeaTreeState;
  cards: AgentContextCard[];
  appliedOperations: string[];
  ignoredOperations: string[];
};

export function applyAgentResponseToIdeaTree(
  state: IdeaTreeState,
  response: BrainstormAgentResponse,
): ApplyAgentResponseResult {
  let nextState = state;
  const cards: AgentContextCard[] = [];
  const appliedOperations: string[] = [];
  const ignoredOperations: string[] = [];

  for (const operation of response.operations) {
    const before = nextState;

    switch (operation.type) {
      case "create_nodes": {
        if (nextState.nodes[operation.parentNodeId]?.status === "parked") {
          ignoredOperations.push(operation.type);
          break;
        }

        nextState = ideaTreeReducer(nextState, {
          type: "grow_from_node",
          nodeId: operation.parentNodeId,
          ideas: operation.ideas,
          source: "ai",
        });
        recordMutation(operation.type, before, nextState, appliedOperations, ignoredOperations);
        break;
      }

      case "set_current_direction": {
        nextState = ideaTreeReducer(nextState, {
          type: "follow_direction",
          nodeId: operation.nodeId,
        });
        recordMutation(operation.type, before, nextState, appliedOperations, ignoredOperations);
        break;
      }

      case "park_node": {
        nextState = ideaTreeReducer(nextState, {
          type: "park_node",
          nodeId: operation.nodeId,
          reason: operation.reason,
        });
        recordMutation(operation.type, before, nextState, appliedOperations, ignoredOperations);
        break;
      }

      case "restore_node": {
        nextState = ideaTreeReducer(nextState, {
          type: "restore_node",
          nodeId: operation.nodeId,
        });
        recordMutation(operation.type, before, nextState, appliedOperations, ignoredOperations);
        break;
      }

      case "create_clear_version": {
        if (!canGenerateClearVersion(nextState)) {
          ignoredOperations.push(operation.type);
          break;
        }

        nextState = ideaTreeReducer(nextState, {
          type: "create_clear_version",
          summary: operation.summary,
          currentDirection: operation.currentDirection,
          parked: operation.parked,
          uncertain: operation.uncertain,
          nextThought: operation.nextThought,
        });
        recordMutation(operation.type, before, nextState, appliedOperations, ignoredOperations);
        if (nextState !== before) {
          cards.push({
            type: "clear_version_draft",
            summary: operation.summary,
            currentDirection: operation.currentDirection,
            parked: operation.parked,
            uncertain: operation.uncertain,
            nextThought: operation.nextThought,
          });
        }
        break;
      }

      case "ask_followup": {
        if (!nextState.nodes[operation.nodeId]) {
          ignoredOperations.push(operation.type);
          break;
        }

        cards.push({
          type: "followup",
          nodeId: operation.nodeId,
          question: operation.question,
        });
        appliedOperations.push(operation.type);
        break;
      }

      case "propose_node_edit": {
        if (!nextState.nodes[operation.nodeId]) {
          ignoredOperations.push(operation.type);
          break;
        }

        cards.push({
          type: "node_edit_suggestion",
          nodeId: operation.nodeId,
          title: operation.title,
          description: operation.description,
          reason: operation.reason,
        });
        appliedOperations.push(operation.type);
        break;
      }

      case "propose_node_merge": {
        if (operation.nodeIds.some((nodeId) => !nextState.nodes[nodeId])) {
          ignoredOperations.push(operation.type);
          break;
        }

        cards.push({
          type: "node_merge_suggestion",
          nodeIds: operation.nodeIds,
          title: operation.title,
          description: operation.description,
          reason: operation.reason,
        });
        appliedOperations.push(operation.type);
        break;
      }
    }
  }

  return {
    state: nextState,
    cards,
    appliedOperations,
    ignoredOperations,
  };
}

function recordMutation(
  operationType: string,
  before: IdeaTreeState,
  after: IdeaTreeState,
  appliedOperations: string[],
  ignoredOperations: string[],
) {
  if (after === before) {
    ignoredOperations.push(operationType);
    return;
  }

  appliedOperations.push(operationType);
}
