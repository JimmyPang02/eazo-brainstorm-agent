import { z } from "zod";

const IdeaTextSchema = z
  .object({
    title: z.string().min(1).max(80),
    description: z.string().max(240).optional(),
  })
  .strict();

const ModelIdeaTextSchema = z
  .object({
    title: z.string().max(80),
    description: z.string().max(240),
  })
  .strict();

export const CreateNodesOperationSchema = z
  .object({
    type: z.literal("create_nodes"),
    parentNodeId: z.string().min(1),
    ideas: z.array(IdeaTextSchema).min(1).max(5),
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

export const SetCurrentDirectionOperationSchema = z
  .object({
    type: z.literal("set_current_direction"),
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

export const CreateClearVersionOperationSchema = z
  .object({
    type: z.literal("create_clear_version"),
    summary: z.string().min(1).max(360),
    currentDirection: z.string().min(1).max(180),
    parked: z.array(z.string().min(1).max(120)).max(8),
    uncertain: z.string().min(1).max(240),
    nextThought: z.string().min(1).max(240),
  })
  .strict();

export const BrainstormAgentOperationSchema = z.discriminatedUnion("type", [
  CreateNodesOperationSchema,
  AskFollowupOperationSchema,
  SetCurrentDirectionOperationSchema,
  ParkNodeOperationSchema,
  RestoreNodeOperationSchema,
  ProposeNodeEditOperationSchema,
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
  "set_current_direction",
  "park_node",
  "restore_node",
  "propose_node_edit",
  "create_clear_version",
]);

export const BrainstormAgentModelOperationSchema = z
  .object({
    type: ModelOperationTypeSchema,
    parentNodeId: z.string().max(200),
    nodeId: z.string().max(200),
    ideas: z.array(ModelIdeaTextSchema).max(5),
    question: z.string().max(180),
    title: z.string().max(80),
    description: z.string().max(240),
    reason: z.string().max(240),
    summary: z.string().max(360),
    currentDirection: z.string().max(180),
    parked: z.array(z.string().max(120)).max(8),
    uncertain: z.string().max(240),
    nextThought: z.string().max(240),
  })
  .strict();

export const BrainstormAgentModelResponseSchema = z
  .object({
    message: z.string().min(1).max(600),
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
    message: response.message,
    operations: response.operations.map((operation) => {
      switch (operation.type) {
        case "create_nodes":
          return {
            type: "create_nodes",
            parentNodeId: requireField(operation.parentNodeId, "parentNodeId"),
            ideas: requireIdeas(operation.ideas),
            rationale: optionalText(operation.reason),
          };

        case "ask_followup":
          return {
            type: "ask_followup",
            nodeId: requireField(operation.nodeId, "nodeId"),
            question: requireField(operation.question, "question"),
          };

        case "set_current_direction":
          return {
            type: "set_current_direction",
            nodeId: requireField(operation.nodeId, "nodeId"),
            reason: optionalText(operation.reason),
          };

        case "park_node":
          return {
            type: "park_node",
            nodeId: requireField(operation.nodeId, "nodeId"),
            reason: optionalText(operation.reason),
          };

        case "restore_node":
          return {
            type: "restore_node",
            nodeId: requireField(operation.nodeId, "nodeId"),
            reason: optionalText(operation.reason),
          };

        case "propose_node_edit":
          return {
            type: "propose_node_edit",
            nodeId: requireField(operation.nodeId, "nodeId"),
            title: optionalText(operation.title),
            description: optionalText(operation.description),
            reason: requireField(operation.reason, "reason"),
          };

        case "create_clear_version":
          return {
            type: "create_clear_version",
            summary: requireField(operation.summary, "summary"),
            currentDirection: requireField(operation.currentDirection, "currentDirection"),
            parked: operation.parked,
            uncertain: requireField(operation.uncertain, "uncertain"),
            nextThought: requireField(operation.nextThought, "nextThought"),
          };
      }
    }),
  });
}

function requireField(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Agent operation is missing ${fieldName}.`);
  }

  return trimmed;
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function requireIdeas(ideas: Array<{ title: string; description: string }>) {
  const normalized = ideas
    .map((idea) => ({
      title: idea.title.trim(),
      description: optionalText(idea.description),
    }))
    .filter((idea) => idea.title);

  if (normalized.length === 0) {
    throw new Error("Agent create_nodes operation is missing ideas.");
  }

  return normalized;
}
