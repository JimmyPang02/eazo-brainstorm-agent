import { describe, expect, test } from "bun:test";

import {
  BrainstormAgentResponseSchema,
  normalizeBrainstormAgentResponse,
} from "./agent-operations";

describe("Brainstorm agent operation schema", () => {
  test("accepts structured operations that update the idea tree", () => {
    const parsed = BrainstormAgentResponseSchema.parse({
      message: "我会先沿当前节点继续长出三个方向。",
      operations: [
        {
          type: "create_nodes",
          parentNodeId: "node-1",
          ideas: [
            { title: "换一个角度", description: "从内容场景看这个想法。" },
            { title: "找一个反例", description: "先看它在哪些情况下不成立。" },
          ],
        },
        {
          type: "ask_followup",
          nodeId: "node-1",
          question: "这个方向最想保留的感觉是什么？",
        },
        {
          type: "propose_node_merge",
          nodeIds: ["node-2", "node-3"],
          title: "内容场景角度",
          description: "两个节点都在说从内容使用场景重新理解这个想法。",
          reason: "它们表达接近，可以作为一个更清楚的方向继续长。",
        },
      ],
    });

    expect(parsed.operations).toHaveLength(3);
    expect(parsed.operations[0].type).toBe("create_nodes");
  });

  test("rejects unsupported operation types", () => {
    expect(() =>
      BrainstormAgentResponseSchema.parse({
        message: "我来生成 PRD。",
        operations: [{ type: "generate_prd", title: "PRD" }],
      }),
    ).toThrow();
  });

  test("normalizes the flat model output shape into strict internal operations", () => {
    const normalized = normalizeBrainstormAgentResponse({
      message: "先发散，再追问。",
      operations: [
        {
          type: "create_nodes",
          parentNodeId: "node-1",
          nodeId: "",
          ideas: [{ title: "换个角度", description: "" }],
          question: "",
          nodeIds: [],
          title: "",
          description: "",
          reason: "从当前节点继续发散",
          summary: "",
          currentDirection: "",
          parked: [],
          uncertain: "",
          nextThought: "",
        },
        {
          type: "ask_followup",
          parentNodeId: "",
          nodeId: "node-1",
          ideas: [],
          question: "这个方向最想保留什么？",
          nodeIds: [],
          title: "",
          description: "",
          reason: "",
          summary: "",
          currentDirection: "",
          parked: [],
          uncertain: "",
          nextThought: "",
        },
      ],
    });

    expect(normalized.operations).toEqual([
      {
        type: "create_nodes",
        parentNodeId: "node-1",
        ideas: [{ title: "换个角度", description: undefined }],
        rationale: "从当前节点继续发散",
      },
      {
        type: "ask_followup",
        nodeId: "node-1",
        question: "这个方向最想保留什么？",
      },
    ]);
  });

  test("normalizes flat model merge proposals without mutating nodes", () => {
    const normalized = normalizeBrainstormAgentResponse({
      message: "这两个节点可以先合并成一个候选方向。",
      operations: [
        {
          type: "propose_node_merge",
          parentNodeId: "",
          nodeId: "",
          ideas: [],
          question: "",
          nodeIds: ["node-2", "node-3"],
          title: "更聚焦的候选方向",
          description: "把两个相近表达合成一个更短的继续方向。",
          reason: "它们都在表达同一个思考分支。",
          summary: "",
          currentDirection: "",
          parked: [],
          uncertain: "",
          nextThought: "",
        },
      ],
    });

    expect(normalized.operations).toEqual([
      {
        type: "propose_node_merge",
        nodeIds: ["node-2", "node-3"],
        title: "更聚焦的候选方向",
        description: "把两个相近表达合成一个更短的继续方向。",
        reason: "它们都在表达同一个思考分支。",
      },
    ]);
  });

  test("rejects flat model operations missing required fields for their type", () => {
    expect(() =>
      normalizeBrainstormAgentResponse({
        message: "我想发散。",
        operations: [
          {
            type: "create_nodes",
            parentNodeId: "",
            nodeId: "",
            ideas: [],
            question: "",
            nodeIds: [],
            title: "",
            description: "",
            reason: "",
            summary: "",
            currentDirection: "",
            parked: [],
            uncertain: "",
            nextThought: "",
          },
        ],
      }),
    ).toThrow();
  });
});
