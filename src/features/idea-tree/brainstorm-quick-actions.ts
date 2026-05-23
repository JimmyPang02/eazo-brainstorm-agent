export type BrainstormQuickActionId =
  | "shift_angle"
  | "find_counterexample"
  | "find_similar_cases"
  | "name_direction"
  | "synthesize_direction"
  | "merge_duplicates";

export type BrainstormQuickAction = {
  id: BrainstormQuickActionId;
  label: string;
  description: string;
};

export type BrainstormQuickActionContext = {
  focusedNodeTitle: string | null;
  currentDirectionTitle: string | null;
  parkedNodeCount: number;
};

export type BrainstormQuickActionRequest = {
  userMessage: string;
  allowWebSearch: boolean;
};

export const BRAINSTORM_QUICK_ACTIONS: BrainstormQuickAction[] = [
  {
    id: "shift_angle",
    label: "换个角度",
    description: "从另一个视角继续发散",
  },
  {
    id: "find_counterexample",
    label: "找反例",
    description: "看哪里会失败或跑偏",
  },
  {
    id: "find_similar_cases",
    label: "找相似案例",
    description: "用外部素材打开思路",
  },
  {
    id: "name_direction",
    label: "命名方向",
    description: "给当前方向起临时名字",
  },
  {
    id: "synthesize_direction",
    label: "提炼方向",
    description: "从树里提炼当前想法",
  },
  {
    id: "merge_duplicates",
    label: "合并重复",
    description: "检查相近节点但不直接删除",
  },
];

export function buildBrainstormQuickActionRequest(
  actionId: BrainstormQuickActionId,
  context: BrainstormQuickActionContext,
): BrainstormQuickActionRequest {
  const target = context.currentDirectionTitle ?? context.focusedNodeTitle ?? "当前这棵 Idea Tree";
  const basketRule =
    context.parkedNodeCount > 0
      ? `已放一边的 ${context.parkedNodeCount} 个方向不要主动绕回，除非这次动作必须引用它们。`
      : "如果没有必要，不要主动引入已经放一边的方向。";

  switch (actionId) {
    case "shift_angle":
      return {
        allowWebSearch: false,
        userMessage: [
          `围绕「${target}」换一个角度继续 brainstorm，长出 3-5 个不重复的新方向。`,
          "不要生成 PRD、brief 或商业计划。",
          basketRule,
        ].join(" "),
      };

    case "find_counterexample":
      return {
        allowWebSearch: false,
        userMessage: [
          `针对「${target}」找 2-3 个反例、失败情形或可能跑偏的位置。`,
          "把它们转成可比较的节点或追问，不要生成 PRD。",
          basketRule,
        ].join(" "),
      };

    case "find_similar_cases":
      return {
        allowWebSearch: true,
        userMessage: [
          `请用网络调研找几个和「${target}」相似案例或参考素材。`,
          "只提炼能帮助 brainstorm 的素材，并转成节点或追问；不要写成报告，不要生成 PRD。",
          basketRule,
        ].join(" "),
      };

    case "name_direction":
      return {
        allowWebSearch: false,
        userMessage: [
          `帮我给「${target}」起 3-5 个临时名字，用来标记当前方向。`,
          "如果想改节点标题，只能给改写建议，不要直接改原节点。",
          "不要生成 PRD。",
          basketRule,
        ].join(" "),
      };

    case "synthesize_direction":
      return {
        allowWebSearch: false,
        userMessage: [
          `从当前树里提炼「${target}」到底在往哪里走。`,
          "优先用简短解释、追问或清晰版本草稿推进，不要生成 PRD。",
          basketRule,
        ].join(" "),
      };

    case "merge_duplicates":
      return {
        allowWebSearch: false,
        userMessage: [
          "检查当前树里有没有重复、相近或可以合并的想法。",
          "不要删除节点；如果要调整文字，只能给改写建议或追问。",
          "不要生成 PRD。",
          basketRule,
        ].join(" "),
      };
  }
}
