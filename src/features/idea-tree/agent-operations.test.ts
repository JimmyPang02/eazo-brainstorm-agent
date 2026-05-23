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

  test("accepts favorite_node and unfavorite_node operations", () => {
    const parsed = BrainstormAgentResponseSchema.parse({
      message: "我把这个方向标为收藏。",
      operations: [
        { type: "favorite_node", nodeId: "node-1" },
        { type: "unfavorite_node", nodeId: "node-2", reason: "之前误标了。" },
      ],
    });
    expect(parsed.operations[0].type).toBe("favorite_node");
    expect(parsed.operations[1].type).toBe("unfavorite_node");
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
          ideas: [
            {
              title: "换个角度",
              description: "",
              quickActionPrompts: {
                shift_angle: "把这个换个角度看看，从用户使用场景的角度展开。",
                find_counterexample: "找一个换个角度也行不通的反例。",
                find_similar_cases: "找几个类似换角度思路的真实案例。",
                synthesize_direction: "提炼一下这个换角度其实指向什么。",
              },
            },
          ],
          question: "",
          nodeIds: [],
          title: "",
          description: "",
          reason: "从当前节点继续发散",
          summary: "",
          favoritedTitles: [],
          parked: [],
          uncertain: "",
          nextThought: "",
          html: "",
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
          favoritedTitles: [],
          parked: [],
          uncertain: "",
          nextThought: "",
          html: "",
        },
      ],
    });

    expect(normalized.operations).toEqual([
      {
        type: "create_nodes",
        parentNodeId: "node-1",
        ideas: [
          {
            title: "换个角度",
            description: undefined,
            quickActionPrompts: {
              shift_angle: "把这个换个角度看看，从用户使用场景的角度展开。",
              find_counterexample: "找一个换个角度也行不通的反例。",
              find_similar_cases: "找几个类似换角度思路的真实案例。",
              synthesize_direction: "提炼一下这个换角度其实指向什么。",
            },
          },
        ],
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
          favoritedTitles: [],
          parked: [],
          uncertain: "",
          nextThought: "",
          html: "",
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

  test("normalizes a create_clear_version with favoritedTitles", () => {
    const normalized = normalizeBrainstormAgentResponse({
      message: "整理一下当前的方向。",
      operations: [
        {
          type: "create_clear_version",
          parentNodeId: "",
          nodeId: "",
          ideas: [],
          question: "",
          nodeIds: [],
          title: "",
          description: "",
          reason: "",
          summary: "当前我们收藏了自然意象类的命名。",
          favoritedTitles: ["自然意象", "短促干脆"],
          parked: ["工具感"],
          uncertain: "还不确定要不要再短。",
          nextThought: "再长几个更短的候选。",
          html: "<section><h2>核心结论</h2><p>自然意象更贴近。</p></section>",
        },
      ],
    });

    expect(normalized.operations).toEqual([
      {
        type: "create_clear_version",
        summary: "当前我们收藏了自然意象类的命名。",
        favoritedTitles: ["自然意象", "短促干脆"],
        parked: ["工具感"],
        uncertain: "还不确定要不要再短。",
        nextThought: "再长几个更短的候选。",
        html: "<section><h2>核心结论</h2><p>自然意象更贴近。</p></section>",
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
            favoritedTitles: [],
            parked: [],
            uncertain: "",
            nextThought: "",
            html: "",
          },
        ],
      }),
    ).toThrow();
  });
});
