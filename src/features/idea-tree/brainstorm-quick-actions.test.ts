import { describe, expect, test } from "bun:test";

import {
  BRAINSTORM_QUICK_ACTIONS,
  buildBrainstormQuickActionRequest,
} from "./brainstorm-quick-actions";

describe("brainstorm quick actions", () => {
  test("exposes the expected brainstorm partner moves", () => {
    expect(BRAINSTORM_QUICK_ACTIONS.map((action) => action.label)).toEqual([
      "换个角度",
      "找反例",
      "找相似案例",
      "命名方向",
      "提炼方向",
      "合并重复",
    ]);
  });

  test("builds context-aware requests that preserve no-PRD behavior and parked ideas", () => {
    const request = buildBrainstormQuickActionRequest("shift_angle", {
      focusedNodeTitle: "一个泛泛的内容工具",
      currentDirectionTitle: "服务创作者选题",
      parkedNodeCount: 2,
    });

    expect(request.allowWebSearch).toBe(false);
    expect(request.userMessage).toContain("服务创作者选题");
    expect(request.userMessage).toContain("不要生成 PRD");
    expect(request.userMessage).toContain("已放一边的 2 个方向不要主动绕回");
  });

  test("uses OpenAI web search only for similar-case research", () => {
    const request = buildBrainstormQuickActionRequest("find_similar_cases", {
      focusedNodeTitle: "一个线下活动玩法",
      currentDirectionTitle: null,
      parkedNodeCount: 0,
    });

    expect(request.allowWebSearch).toBe(true);
    expect(request.userMessage).toContain("网络调研");
    expect(request.userMessage).toContain("相似案例");
  });

  test("keeps naming as suggestions instead of direct node edits", () => {
    const request = buildBrainstormQuickActionRequest("name_direction", {
      focusedNodeTitle: "帮助用户整理创作灵感",
      currentDirectionTitle: null,
      parkedNodeCount: 1,
    });

    expect(request.allowWebSearch).toBe(false);
    expect(request.userMessage).toContain("临时名字");
    expect(request.userMessage).toContain("改写建议");
    expect(request.userMessage).toContain("不要直接改");
  });
});
