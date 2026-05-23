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
  getFavoritedNodes,
  getParkedNodes,
  type BrainstormAction,
  type AgentRun,
  type ClearVersion,
  type IdeaEdge,
  type IdeaNode,
  type IdeaTreeState,
} from "./idea-tree-reducer";

export const DEFAULT_BRAINSTORM_AGENT_MODEL =
  process.env.OPENAI_AGENT_MODEL ?? "gpt-5-mini";

export const BRAINSTORM_AGENT_SYSTEM_PROMPT = [
  "你是一个 Brainstorm 思考伙伴。",
  "你的任务是帮助用户把模糊想法变得更清楚：发散、追问、剪枝、收藏认可的方向、暂时放一边，并在用户已经收藏过想法后生成阶段性清晰版本。",
  "不要默认生成 PRD、brief、商业计划、pitch 或最终交付物。除非用户明确要求，否则只推进 brainstorm。",
  "不要把 Idea Node 强行分类成用户、痛点、方案、PRD 字段或 rubric。节点只是短想法片段。",
  "优先通过结构化操作推进树，而不是只聊天。",
  "create_nodes 每次最多 4 个 ideas，默认 3-4 个。质量优先：每个方向都要有差异，不要凑数。",
  "每个 idea 的 description 用 1-2 句中文，控制在 80 中文字符以内（最多 240 个字符），紧扣 title 把意图讲清楚即可，不要堆砌细节。",
  "每个 idea 必须填 quickActionPrompts，这是用户点击该节点继续长时会用到的 4 个一键续写提示语：",
  "  - shift_angle: 一句中文祈使句，引导从一个明显不同的角度继续发散这个节点（≤80 字）。",
  "  - find_counterexample: 一句中文祈使句，引导给出这个节点会失败、跑偏或站不住的反例（≤80 字）。",
  "  - find_similar_cases: 一句中文祈使句，引导寻找和这个节点相似的真实案例或参考素材（≤80 字）。",
  "  - synthesize_direction: 一句中文祈使句，引导提炼这个节点其实在指向什么方向（≤80 字）。",
  "  - 每条 prompt 必须紧扣该 idea 的具体内容，不要写成放在哪个节点都成立的通用句子；不要要求生成 PRD/报告。",
  "树上同时可以有多条方向并行生长，不要假设有唯一的『当前方向』。",
  "收藏(favorited)的节点代表用户认可的方向，可以多选，是 brainstorm 的正向素材。",
  "放一边(parked)的节点是被舍弃的想法，仍留在树上但不属于主动发散上下文，除非用户明确恢复或点名。",
  "可以使用网络搜索补充外部素材，但只在用户需要案例、事实、趋势或反例时使用。搜索结果要变成 brainstorm 素材，不要变成报告。",
  "改写用户核心描述前，只能用 propose_node_edit 给建议，不要直接改原文。",
  "发现重复或相近节点时，只能用 propose_node_merge 给合并建议，不要删除节点。",
  "输出必须符合结构化操作 schema，并给一段很短的 message 解释你在做什么。",
  "当使用 create_clear_version 收敛时，html 字段必须是一份可以直接 srcDoc 渲染的多模态收敛报告：",
  "  - 输出完整 HTML 片段（可以从 <section> 或 <article> 起，不要 <html>/<head>/<body>/<script>/<style> 标签，也不要外链 CSS/JS/图片）。",
  "  - 允许用 <h2><h3><p><ul><ol><li><strong><em><blockquote><table><thead><tbody><tr><th><td><hr><br><span><div><figure><figcaption><code>。所有 style 必须写成元素 style 属性，使用安全的 CSS（颜色、字号、间距、边框、圆角、grid/flex）。",
  "  - 内容必须包含：① 一句核心结论；② 用户已收藏的方向（用卡片或表格突出，并解释为什么这条值得继续）；③ 暂时放一边的方向（如有，用更弱的视觉对比呈现）；④ 还不确定/需要继续验证的问题；⑤ 下一步可以怎么继续想。",
  "  - 文案紧凑、不堆砌，适合一屏内浏览。允许用 emoji、彩色 chip、轻量分隔线增加层次。",
  "  - 同时仍要填写 summary / favoritedTitles / parked / uncertain / nextThought 这些纯文本字段，作为 HTML 渲染失败时的兜底。",
].join("\n");

const IdeaNodePayloadSchema: z.ZodType<IdeaNode> = z
  .object({
    id: z.string().min(1),
    treeId: z.string().min(1),
    parentId: z.string().min(1).nullable(),
    title: z.string().min(1).max(160),
    description: z.string().max(500).optional(),
    source: z.enum(["user", "ai"]),
    status: z.enum(["active", "parked"]),
    favorited: z.boolean(),
    x: z.number(),
    y: z.number(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    quickActionPrompts: z
      .object({
        shift_angle: z.string().min(1).max(200),
        find_counterexample: z.string().min(1).max(200),
        find_similar_cases: z.string().min(1).max(200),
        synthesize_direction: z.string().min(1).max(200),
      })
      .strict()
      .optional(),
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
    type: z.literal("favorite_node"),
    nodeId: z.string().min(1),
  }).strict(),
  BrainstormActionBaseSchema.extend({
    type: z.literal("unfavorite_node"),
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
    type: z.literal("edit_node"),
    nodeId: z.string().min(1),
    previousTitle: z.string().min(1),
    previousDescription: z.string().optional(),
    nextTitle: z.string().min(1),
    nextDescription: z.string().optional(),
  }).strict(),
  BrainstormActionBaseSchema.extend({
    type: z.literal("create_clear_version"),
    clearVersionId: z.string().min(1),
  }).strict(),
  BrainstormActionBaseSchema.extend({
    type: z.literal("seed_root"),
    nodeId: z.string().min(1),
    title: z.string().min(1),
  }).strict(),
]);

const ClearVersionPayloadSchema: z.ZodType<ClearVersion> = z
  .object({
    id: z.string().min(1),
    treeId: z.string().min(1),
    createdAt: z.string().min(1),
    summary: z.string().min(1).max(800),
    favoritedTitles: z.array(z.string().min(1).max(160)).min(1).max(20),
    parked: z.array(z.string()).max(20),
    uncertain: z.string().min(1).max(800),
    nextThought: z.string().min(1).max(800),
    html: z.string().min(1).max(20000),
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
    nodes: z.record(z.string(), IdeaNodePayloadSchema),
    edges: z.record(z.string(), IdeaEdgePayloadSchema),
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
  favorited: boolean;
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
    favoritedNodes: getFavoritedNodes(request.state).map(toContextNode),
    activeNodes: getActiveNodes(request.state).map(toContextNode),
    edges: getContextEdges(request.state),
    parkedNodes: getParkedNodes(request.state).map(toContextNode),
    recentActions: request.state.actions.slice(-8),
    recentAgentRuns: request.state.agentRuns.slice(-6),
    clearVersionAvailable: canGenerateClearVersion(request.state),
    latestClearVersion: request.state.clearVersions.at(-1) ?? null,
    rules: [
      "parked_nodes_are_not_active_context",
      "favorited_nodes_are_user_endorsed_directions",
      "do_not_generate_prd_by_default",
      "node_text_edits_must_be_suggestions",
      "prefer_structured_operations",
      "multiple_branches_can_grow_in_parallel",
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
      "如果用户已经收藏了想法且发散过至少一次，可以 create_clear_version；favoritedTitles 必须列出当前 favoritedNodes 的标题；html 必须是一份完整的多模态收敛报告片段（参见 system 指令）。其它 operation 的 html 字段填空字符串。",
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
    favorited: node.favorited,
    source: node.source,
  };
}
