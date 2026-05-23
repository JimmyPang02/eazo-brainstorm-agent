import type { IdeaNode } from "./idea-tree-reducer";

export function NodeActions({
  node,
  onGrow,
  onFollow,
  onPark,
}: {
  node: IdeaNode;
  onGrow: () => void;
  onFollow: () => void;
  onPark: () => void;
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
          className="rounded-full bg-[#edf1e7] px-3 py-2 text-xs font-medium text-[#355f49]"
        >
          继续长
        </button>
        <button
          type="button"
          onClick={onFollow}
          className="rounded-full bg-[#355f49] px-3 py-2 text-xs font-medium text-white"
        >
          沿这条继续
        </button>
        <button
          type="button"
          onClick={onPark}
          className="rounded-full bg-[#f7ece0] px-3 py-2 text-xs font-medium text-[#7a4525]"
        >
          放一边
        </button>
      </div>
    </div>
  );
}
