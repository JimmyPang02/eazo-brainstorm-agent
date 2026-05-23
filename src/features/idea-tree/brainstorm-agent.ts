import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  BrainstormAgentModelResponseSchema,
  normalizeBrainstormAgentResponse,
  type BrainstormAgentResponse,
} from "./agent-operations";
import {
  canGenerateClearVersion,
  getActiveNodes,
  getParkedNodes,
  type BrainstormAction,
  type AgentRun,
  type ClearVersion,
  type IdeaEdge,
  type IdeaNode,
  type IdeaTreeState,
} from "./idea-tree-reducer";

export const DEFAULT_BRAINSTORM_AGENT_MODEL =
  process.env.OPENAI_AGENT_MODEL ?? "gpt-5.2";

export const BRAINSTORM_AGENT_SYSTEM_PROMPT = [
  "你是一个 Brainstorm 思考伙伴。",
  "你的任务是帮助用户把模糊想法变得更清楚：发散、追问、剪枝、沿某条方向继续、暂时放一边，并在有取舍痕迹后生成阶段性清晰版本。",
  "不要默认生成 PRD、brief、商业计划、pitch 或最终交付物。除非用户明确要求，否则只推进 brainstorm。",
  "不要把 Idea Node 强行分类成用户、痛点、方案、PRD 字段或 rubric。节点只是短想法片段。",
  "优先通过结构化操作推进树，而不是只聊天。",
  "尊重想法篮子。已放一边的节点不属于主动发散上下文，除非用户明确恢复或点名。",
  "可以使用网络搜索补充外部素材，但只在用户需要案例、事实、趋势或反例时使用。搜索结果要变成 brainstorm 素材，不要变成报告。",
  "改写用户核心描述前，只能用 propose_node_edit 给建议，不要直接改原文。",
  "输出必须符合结构化操作 schema，并给一段很短的 message 解释你在做什么。",
].join("\n");

const IdeaNodePayloadSchema: z.ZodType<IdeaNode> = z
  .object({
    id: z.string().min(1),
    treeId: z.string().min(1),
    parentId: z.string().min(1).nullable(),
    title: z.string().min(1).max(160),
    description: z.string().max(500).optional(),
    source: z.enum(["user", "ai"]),
    status: z.enum(["active", "current", "parked"]),
    x: z.number(),
    y: z.number(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict();

const IdeaEdgePayloadSchema: z.ZodType<IdeaEdge> = z
  .object({
    id: z.string().min(1),
    treeId: z.string().min(1),
    parentNodeId: z.string().min(1),
    childNodeId: z.string().min(1),
    source: z.enum(["user", "ai"]),
    createdAt: z.string().min(1),
  })
  .strict();

const BrainstormActionBaseSchema = z.object({
  id: z.string().min(1),
  treeId: z.string().min(1),
  createdAt: z.string().min(1),
});

const BrainstormActionPayloadSchema: z.ZodType<BrainstormAction> = z.discriminatedUnion("type", [
  BrainstormActionBaseSchema.extend({
    type: z.literal("grow_from_node"),
    nodeId: z.string().min(1),
    createdNodeIds: z.array(z.string().min(1)),
    source: z.enum(["user", "ai"]),
  }).strict(),
  BrainstormActionBaseSchema.extend({
    type: z.literal("follow_direction"),
    nodeId: z.string().min(1),
  }).strict(),
  BrainstormActionBaseSchema.extend({
    type: z.literal("park_node"),
    nodeId: z.string().min(1),
    reason: z.string().optional(),
  }).strict(),
  BrainstormActionBaseSchema.extend({
    type: z.literal("restore_node"),
    nodeId: z.string().min(1),
  }).strict(),
  BrainstormActionBaseSchema.extend({
    type: z.literal("add_seed_thought"),
    nodeId: z.string().min(1),
  }).strict(),
  BrainstormActionBaseSchema.extend({
    type: z.literal("create_clear_version"),
    clearVersionId: z.string().min(1),
  }).strict(),
]);

const ClearVersionPayloadSchema: z.ZodType<ClearVersion> = z
  .object({
    id: z.string().min(1),
    treeId: z.string().min(1),
    createdAt: z.string().min(1),
    summary: z.string().min(1).max(800),
    currentDirection: z.string().min(1).max(400),
    parked: z.array(z.string()).max(20),
    uncertain: z.string().min(1).max(800),
    nextThought: z.string().min(1).max(800),
  })
  .strict();

const AgentRunPayloadSchema: z.ZodType<AgentRun> = z
  .object({
    id: z.string().min(1),
    treeId: z.string().min(1),
    createdAt: z.string().min(1),
    userMessage: z.string(),
    agentMessage: z.string(),
    operationTypes: z.array(z.string()),
    appliedOperationTypes: z.array(z.string()),
    ignoredOperationTypes: z.array(z.string()),
  })
  .strict();

const IdeaTreeStatePayloadSchema: z.ZodType<IdeaTreeState> = z
  .object({
    treeId: z.string().min(1),
    title: z.string().min(1).max(200),
    rootNodeId: z.string().min(1),
    focusedNodeId: z.string().min(1),
    currentDirectionNodeId: z.string().min(1).nullable(),
    nodes: z.record(z.string(), IdeaNodePayloadSchema),
    edges: z.record(z.string(), IdeaEdgePayloadSchema),
    basketNodeIds: z.array(z.string()).max(80),
    actions: z.array(BrainstormActionPayloadSchema).max(120),
    agentRuns: z.array(AgentRunPayloadSchema).max(80),
    clearVersions: z.array(ClearVersionPayloadSchema).max(20),
  })
  .strict();

export const BrainstormAgentRunRequestSchema = z
  .object({
    state: IdeaTreeStatePayloadSchema,
    focusedNodeId: z.string().min(1).optional(),
    userMessage: z.string().max(1200).default(""),
    allowWebSearch: z.boolean().default(false),
    intent: z
      .enum(["free_chat", "grow", "followup", "research", "summarize"])
      .optional(),
  })
  .strict();

export type BrainstormAgentRunRequest = z.infer<typeof BrainstormAgentRunRequestSchema>;

export type BrainstormAgentContext = ReturnType<typeof buildBrainstormAgentContext>;

type ContextNode = {
  id: string;
  parentId: string | null;
  title: string;
  description?: string;
  status: IdeaNode["status"];
  source: IdeaNode["source"];
};

type ContextEdge = {
  id: string;
  parentNodeId: string;
  childNodeId: string;
  source: IdeaEdge["source"];
};

export function buildBrainstormAgentContext(request: BrainstormAgentRunRequest) {
  const focusedNodeId = request.focusedNodeId ?? request.state.focusedNodeId;
  const focusedNode = request.state.nodes[focusedNodeId] ?? null;
  const currentDirection = request.state.currentDirectionNodeId
    ? request.state.nodes[request.state.currentDirectionNodeId] ?? null
    : null;

  return {
    userMessage: request.userMessage,
    intent: request.intent ?? "free_chat",
    allowWebSearch: request.allowWebSearch,
    tree: {
      id: request.state.treeId,
      title: request.state.title,
      rootNodeId: request.state.rootNodeId,
    },
    focusedNode: focusedNode ? toContextNode(focusedNode) : null,
    currentDirection: currentDirection ? toContextNode(currentDirection) : null,
    activeNodes: getActiveNodes(request.state).map(toContextNode),
    edges: getContextEdges(request.state),
    ideaBasket: getParkedNodes(request.state).map(toContextNode),
    recentActions: request.state.actions.slice(-8),
    recentAgentRuns: request.state.agentRuns.slice(-6),
    clearVersionAvailable: canGenerateClearVersion(request.state),
    latestClearVersion: request.state.clearVersions.at(-1) ?? null,
    rules: [
      "idea_basket_is_not_active_context",
      "do_not_generate_prd_by_default",
      "node_text_edits_must_be_suggestions",
      "prefer_structured_operations",
    ],
  };
}

export function buildOpenAIResponsesParams(
  request: BrainstormAgentRunRequest,
  model = DEFAULT_BRAINSTORM_AGENT_MODEL,
) {
  const context = buildBrainstormAgentContext(request);

  return {
    model,
    instructions: BRAINSTORM_AGENT_SYSTEM_PROMPT,
    input: [
    "请根据下面的 Idea Tree 上下文，选择最少但有效的结构化操作推进 brainstorm。",
      "每个 operation 必须填满所有字段；不适用于该 type 的 string 字段填空字符串，array 字段填空数组。",
      "如果用户只是让你继续想，优先 create_nodes 或 ask_followup。",
      "如果上下文已经有当前方向和取舍痕迹，可以 create_clear_version。",
      "上下文 JSON：",
      JSON.stringify(context, null, 2),
    ].join("\n"),
    text: {
      format: zodTextFormat(BrainstormAgentModelResponseSchema, "brainstorm_agent_response"),
    },
    tools: request.allowWebSearch ? ([{ type: "web_search_preview" }] as const) : undefined,
  };
}

export type BrainstormOpenAIClient = {
  responses: {
    parse: (
      params: ReturnType<typeof buildOpenAIResponsesParams>,
    ) => PromiseLike<{ output_parsed: unknown }>;
  };
};

export async function runBrainstormAgent({
  client,
  request,
  model = DEFAULT_BRAINSTORM_AGENT_MODEL,
}: {
  client: BrainstormOpenAIClient;
  request: BrainstormAgentRunRequest;
  model?: string;
}): Promise<BrainstormAgentResponse> {
  const response = await client.responses.parse(buildOpenAIResponsesParams(request, model));
  if (!response.output_parsed) {
    throw new Error("Brainstorm agent returned no structured operations.");
  }

  return normalizeBrainstormAgentResponse(
    BrainstormAgentModelResponseSchema.parse(response.output_parsed),
  );
}

function getContextEdges(state: IdeaTreeState): ContextEdge[] {
  return Object.values(state.edges)
    .filter((edge) => {
      const parent = state.nodes[edge.parentNodeId];
      const child = state.nodes[edge.childNodeId];
      return parent?.status !== "parked" && child?.status !== "parked";
    })
    .map((edge) => ({
      id: edge.id,
      parentNodeId: edge.parentNodeId,
      childNodeId: edge.childNodeId,
      source: edge.source,
    }));
}

function toContextNode(node: IdeaNode): ContextNode {
  return {
    id: node.id,
    parentId: node.parentId,
    title: node.title,
    description: node.description,
    status: node.status,
    source: node.source,
  };
}
