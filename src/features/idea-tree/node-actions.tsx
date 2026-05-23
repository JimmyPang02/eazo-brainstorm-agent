import {
  BRAINSTORM_QUICK_ACTIONS,
  type BrainstormQuickActionId,
} from "./brainstorm-quick-actions";
import type { IdeaNode } from "./idea-tree-reducer";

const FOLLOWUP_QUICK_ACTION_IDS: BrainstormQuickActionId[] = [
  "shift_angle",
  "find_counterexample",
  "find_similar_cases",
  "synthesize_direction",
];

const FOLLOWUP_QUICK_ACTIONS = FOLLOWUP_QUICK_ACTION_IDS.map((id) => {
  const action = BRAINSTORM_QUICK_ACTIONS.find((candidate) => candidate.id === id);
  if (!action) throw new Error(`missing quick action: ${id}`);
  return action;
});

export function NodeActions({
  node,
  onGrow,
  onFollow,
  onPark,
  onQuickAction,
  disabled = false,
}: {
  node: IdeaNode;
  onGrow: () => void;
  onFollow: () => void;
  onPark: () => void;
  onQuickAction: (actionId: BrainstormQuickActionId) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="absolute z-20 w-[286px] rounded-2xl border border-[#b6724242] bg-[#fffdf8f7] p-4 shadow-[0_18px_44px_rgba(50,56,45,0.12),0_2px_8px_rgba(50,56,45,0.06)]"
      style={{ left: Math.min(node.x + 180, 672), top: Math.max(node.y - 24, 136) }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b67242]">
        节点追问
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[#38443c]">
        这个想法要继续变清楚，下一步更适合发散、沿它继续，还是先放一边？
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGrow}
          disabled={disabled}
          className="rounded-full bg-[#edf1e7] px-3 py-2 text-xs font-medium text-[#355f49] disabled:cursor-not-allowed disabled:opacity-45"
        >
          继续长
        </button>
        <button
          type="button"
          onClick={onFollow}
          disabled={disabled}
          className="rounded-full bg-[#355f49] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          沿这条继续
        </button>
        <button
          type="button"
          onClick={onPark}
          disabled={disabled}
          className="rounded-full bg-[#f7ece0] px-3 py-2 text-xs font-medium text-[#7a4525] disabled:cursor-not-allowed disabled:opacity-45"
        >
          放一边
        </button>
      </div>

      <div className="mt-4 border-t border-[#b6724226] pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b948c]">
          让 AI 帮忙
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {FOLLOWUP_QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onQuickAction(action.id)}
              disabled={disabled}
              title={action.description}
              className="rounded-xl border border-[#3440371a] bg-[#f8f6ef] px-2.5 py-2 text-left text-[11px] font-medium text-[#38443c] transition hover:bg-[#eef4e8] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
