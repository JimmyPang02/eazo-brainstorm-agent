import type { BrainstormAgentResponse } from "./agent-operations";
import type { BrainstormAgentRunRequest } from "./brainstorm-agent";
import type { ApplyAgentResponseResult } from "./apply-agent-operations";
import {
  createInitialIdeaTreeState,
  getActiveNodes,
} from "./idea-tree-reducer";

const SMOKE_TREE_ID = "smoke-idea-tree";
const SMOKE_IDEA = "想做一个让人把模糊想法想清楚的 brainstorm 工具";

export type BrainstormAgentSmokeSummary = {
  ok: true;
  model: string;
  operationTypes: string[];
  appliedOperations: string[];
  ignoredOperations: string[];
  activeNodeTitles: string[];
  clearVersionCount: number;
};

export function createBrainstormAgentSmokeRequest(): BrainstormAgentRunRequest {
  const state = createInitialIdeaTreeState(SMOKE_TREE_ID, SMOKE_IDEA);

  return {
    state,
    focusedNodeId: state.rootNodeId,
    userMessage: "请继续长出三个不同方向，保持 brainstorm，不要生成 PRD。",
    allowWebSearch: false,
    intent: "grow",
  };
}

export function summarizeBrainstormAgentSmokeResult({
  model,
  response,
  result,
}: {
  model: string;
  response: BrainstormAgentResponse;
  result: ApplyAgentResponseResult;
}): BrainstormAgentSmokeSummary {
  return {
    ok: true,
    model,
    operationTypes: response.operations.map((operation) => operation.type),
    appliedOperations: result.appliedOperations,
    ignoredOperations: result.ignoredOperations,
    activeNodeTitles: getActiveNodes(result.state).map((node) => node.title),
    clearVersionCount: result.state.clearVersions.length,
  };
}
