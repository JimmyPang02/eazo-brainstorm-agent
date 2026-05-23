import type { IdeaNode, IdeaTreeState } from "./idea-tree-reducer";

export function ClearVersionModal({
  state,
  currentDirection,
  parkedNodes,
  onClose,
}: {
  state: IdeaTreeState;
  currentDirection: IdeaNode | null;
  parkedNodes: IdeaNode[];
  onClose: () => void;
}) {
  const latest = state.clearVersions.at(-1);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#1d252066] p-6"
      role="dialog"
      aria-modal="true"
      aria-label="清晰版本"
    >
      <div className="w-[min(720px,100%)] rounded-3xl bg-[#fffdf8] p-6 shadow-[0_28px_80px_rgba(20,26,21,0.24)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b948c]">
          Clear Version
        </div>
        <h2 className="mt-2 text-xl font-semibold">这一轮想法现在更清楚了</h2>
        <div className="mt-5 grid gap-3 text-sm leading-relaxed">
          <ClearRow label="现在我想清楚的是" value={latest?.summary ?? "这棵树正在逐渐收束。"} />
          <ClearRow label="我正在沿这条继续" value={currentDirection?.title ?? "还没有明确当前方向。"} />
          <ClearRow label="我先放一边" value={parkedNodes.map((node) => node.title).join("、") || "暂时没有。"} />
          <ClearRow label="我还不确定" value={latest?.uncertain ?? "还需要继续发散几个可能性。"} />
          <ClearRow label="下一步可以怎么想" value={latest?.nextThought ?? "继续长出几个更小想法。"} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#edf1e7] px-4 py-2 text-sm font-medium text-[#355f49]"
          >
            继续想
          </button>
        </div>
      </div>
    </div>
  );
}

function ClearRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f5f2ea] p-4">
      <strong>{label}：</strong>
      {value}
    </div>
  );
}
