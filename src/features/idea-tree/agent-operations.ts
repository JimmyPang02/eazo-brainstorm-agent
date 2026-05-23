import { z } from "zod";

const NodeQuickActionPromptsSchema = z
  .object({
    shift_angle: z.string().min(1).max(200),
    find_counterexample: z.string().min(1).max(200),
    find_similar_cases: z.string().min(1).max(200),
    synthesize_direction: z.string().min(1).max(200),
  })
  .strict();

export type NodeQuickActionPrompts = z.infer<typeof NodeQuickActionPromptsSchema>;

const IdeaTextSchema = z
  .object({
    title: z.string().min(1).max(80),
    description: z.string().max(240).optional(),
    quickActionPrompts: NodeQuickActionPromptsSchema.optional(),
  })
  .strict();

// Model-facing schemas omit string length caps. OpenAI's structured-output mode
// does not reliably honor `maxLength`, so over-long strings used to crash the
// whole run. We accept whatever the model writes here and clip downstream
// inside `normalizeBrainstormAgentResponse` before the strict client schema.
const ModelNodeQuickActionPromptsSchema = z
  .object({
    shift_angle: z.string(),
    find_counterexample: z.string(),
    find_similar_cases: z.string(),
    synthesize_direction: z.string(),
  })
  .strict();

const ModelIdeaTextSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    quickActionPrompts: ModelNodeQuickActionPromptsSchema,
  })
  .strict();

export const CreateNodesOperationSchema = z
  .object({
    type: z.literal("create_nodes"),
    parentNodeId: z.string().min(1),
    ideas: z.array(IdeaTextSchema).min(1).max(4),
    rationale: z.string().max(240).optional(),
  })
  .strict();

export const AskFollowupOperationSchema = z
  .object({
    type: z.literal("ask_followup"),
    nodeId: z.string().min(1),
    question: z.string().min(1).max(180),
  })
  .strict();

export const FavoriteNodeOperationSchema = z
  .object({
    type: z.literal("favorite_node"),
    nodeId: z.string().min(1),
    reason: z.string().max(240).optional(),
  })
  .strict();

export const UnfavoriteNodeOperationSchema = z
  .object({
    type: z.literal("unfavorite_node"),
    nodeId: z.string().min(1),
    reason: z.string().max(240).optional(),
  })
  .strict();

export const ParkNodeOperationSchema = z
  .object({
    type: z.literal("park_node"),
    nodeId: z.string().min(1),
    reason: z.string().max(240).optional(),
  })
  .strict();

export const RestoreNodeOperationSchema = z
  .object({
    type: z.literal("restore_node"),
    nodeId: z.string().min(1),
    reason: z.string().max(240).optional(),
  })
  .strict();

export const ProposeNodeEditOperationSchema = z
  .object({
    type: z.literal("propose_node_edit"),
    nodeId: z.string().min(1),
    title: z.string().min(1).max(80).optional(),
    description: z.string().min(1).max(240).optional(),
    reason: z.string().min(1).max(240),
  })
  .strict();

export const ProposeNodeMergeOperationSchema = z
  .object({
    type: z.literal("propose_node_merge"),
    nodeIds: z.array(z.string().min(1)).min(2).max(5),
    title: z.string().min(1).max(80),
    description: z.string().min(1).max(240),
    reason: z.string().min(1).max(240),
  })
  .strict();

export const CreateClearVersionOperationSchema = z
  .object({
    type: z.literal("create_clear_version"),
    summary: z.string().min(1).max(360),
    favoritedTitles: z.array(z.string().min(1).max(120)).min(1).max(12),
    parked: z.array(z.string().min(1).max(120)).max(8),
    uncertain: z.string().min(1).max(240),
    nextThought: z.string().min(1).max(240),
    html: z.string().min(1).max(8000),
  })
  .strict();

export const BrainstormAgentOperationSchema = z.discriminatedUnion("type", [
  CreateNodesOperationSchema,
  AskFollowupOperationSchema,
  FavoriteNodeOperationSchema,
  UnfavoriteNodeOperationSchema,
  ParkNodeOperationSchema,
  RestoreNodeOperationSchema,
  ProposeNodeEditOperationSchema,
  ProposeNodeMergeOperationSchema,
  CreateClearVersionOperationSchema,
]);

export const BrainstormAgentResponseSchema = z
  .object({
    message: z.string().min(1).max(600),
    operations: z.array(BrainstormAgentOperationSchema).min(1).max(8),
  })
  .strict();

const ModelOperationTypeSchema = z.enum([
  "create_nodes",
  "ask_followup",
  "favorite_node",
  "unfavorite_node",
  "park_node",
  "restore_node",
  "propose_node_edit",
  "propose_node_merge",
  "create_clear_version",
]);

export const BrainstormAgentModelOperationSchema = z
  .object({
    type: ModelOperationTypeSchema,
    parentNodeId: z.string(),
    nodeId: z.string(),
    nodeIds: z.array(z.string()).max(5),
    ideas: z.array(ModelIdeaTextSchema).max(4),
    question: z.string(),
    title: z.string(),
    description: z.string(),
    reason: z.string(),
    summary: z.string(),
    favoritedTitles: z.array(z.string()).max(12),
    parked: z.array(z.string()).max(8),
    uncertain: z.string(),
    nextThought: z.string(),
    html: z.string(),
  })
  .strict();

export const BrainstormAgentModelResponseSchema = z
  .object({
    message: z.string().min(1),
    operations: z.array(BrainstormAgentModelOperationSchema).min(1).max(8),
  })
  .strict();

export type BrainstormAgentOperation = z.infer<typeof BrainstormAgentOperationSchema>;
export type BrainstormAgentResponse = z.infer<typeof BrainstormAgentResponseSchema>;
export type BrainstormAgentModelResponse = z.infer<typeof BrainstormAgentModelResponseSchema>;

export function normalizeBrainstormAgentResponse(
  response: BrainstormAgentModelResponse,
): BrainstormAgentResponse {
  return BrainstormAgentResponseSchema.parse({
    message: clip(response.message.trim(), 600),
    operations: response.operations.map((operation) => {
      switch (operation.type) {
        case "create_nodes":
          return {
            type: "create_nodes",
            parentNodeId: requireField(operation.parentNodeId, "parentNodeId"),
            ideas: requireIdeas(operation.ideas),
            rationale: optionalText(operation.reason, 240),
          };

        case "ask_followup":
          return {
            type: "ask_followup",
            nodeId: requireField(operation.nodeId, "nodeId"),
            question: requireField(operation.question, "question", 180),
          };

        case "favorite_node":
          return {
            type: "favorite_node",
            nodeId: requireField(operation.nodeId, "nodeId"),
            reason: optionalText(operation.reason, 240),
          };

        case "unfavorite_node":
          return {
            type: "unfavorite_node",
            nodeId: requireField(operation.nodeId, "nodeId"),
            reason: optionalText(operation.reason, 240),
          };

        case "park_node":
          return {
            type: "park_node",
            nodeId: requireField(operation.nodeId, "nodeId"),
            reason: optionalText(operation.reason, 240),
          };

        case "restore_node":
          return {
            type: "restore_node",
            nodeId: requireField(operation.nodeId, "nodeId"),
            reason: optionalText(operation.reason, 240),
          };

        case "propose_node_edit":
          return {
            type: "propose_node_edit",
            nodeId: requireField(operation.nodeId, "nodeId"),
            title: optionalText(operation.title, 80),
            description: optionalText(operation.description, 240),
            reason: requireField(operation.reason, "reason", 240),
          };

        case "propose_node_merge":
          return {
            type: "propose_node_merge",
            nodeIds: requireNodeIds(operation.nodeIds),
            title: requireField(operation.title, "title", 80),
            description: requireField(operation.description, "description", 240),
            reason: requireField(operation.reason, "reason", 240),
          };

        case "create_clear_version":
          return {
            type: "create_clear_version",
            summary: requireField(operation.summary, "summary", 360),
            favoritedTitles: requireFavoritedTitles(operation.favoritedTitles),
            parked: operation.parked
              .map((title) => clip(title.trim(), 120))
              .filter(Boolean),
            uncertain: requireField(operation.uncertain, "uncertain", 240),
            nextThought: requireField(operation.nextThought, "nextThought", 240),
            html: requireField(operation.html, "html", 8000),
          };
      }
    }),
  });
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function requireNodeIds(nodeIds: string[]): string[] {
  const normalized = nodeIds.map((nodeId) => nodeId.trim()).filter(Boolean);
  if (normalized.length < 2) {
    throw new Error("Agent propose_node_merge operation needs at least two nodeIds.");
  }

  return normalized;
}

function requireFavoritedTitles(titles: string[]): string[] {
  const normalized = titles
    .map((title) => clip(title.trim(), 120))
    .filter(Boolean);
  if (normalized.length === 0) {
    throw new Error("Agent create_clear_version operation needs at least one favoritedTitles entry.");
  }

  return normalized;
}

function requireField(value: string, fieldName: string, max?: number): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Agent operation is missing ${fieldName}.`);
  }

  return max ? clip(trimmed, max) : trimmed;
}

function optionalText(value: string, max?: number): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return max ? clip(trimmed, max) : trimmed;
}

function requireIdeas(
  ideas: Array<{
    title: string;
    description: string;
    quickActionPrompts?: {
      shift_angle: string;
      find_counterexample: string;
      find_similar_cases: string;
      synthesize_direction: string;
    };
  }>,
) {
  const normalized = ideas
    .map((idea) => ({
      title: clip(idea.title.trim(), 80),
      description: optionalText(idea.description, 240),
      quickActionPrompts: normalizeQuickActionPrompts(idea.quickActionPrompts),
    }))
    .filter((idea) => idea.title);

  if (normalized.length === 0) {
    throw new Error("Agent create_nodes operation is missing ideas.");
  }

  return normalized;
}

function normalizeQuickActionPrompts(
  prompts:
    | {
        shift_angle: string;
        find_counterexample: string;
        find_similar_cases: string;
        synthesize_direction: string;
      }
    | undefined,
): NodeQuickActionPrompts | undefined {
  if (!prompts) return undefined;
  const shift_angle = prompts.shift_angle?.trim();
  const find_counterexample = prompts.find_counterexample?.trim();
  const find_similar_cases = prompts.find_similar_cases?.trim();
  const synthesize_direction = prompts.synthesize_direction?.trim();
  if (
    !shift_angle ||
    !find_counterexample ||
    !find_similar_cases ||
    !synthesize_direction
  ) {
    return undefined;
  }
  return {
    shift_angle: clip(shift_angle, 200),
    find_counterexample: clip(find_counterexample, 200),
    find_similar_cases: clip(find_similar_cases, 200),
    synthesize_direction: clip(synthesize_direction, 200),
  };
}
