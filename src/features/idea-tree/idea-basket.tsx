import type { IdeaNode } from "./idea-tree-reducer";

export function IdeaBasket({
  nodes,
  onRestore,
}: {
  nodes: IdeaNode[];
  onRestore: (nodeId: string) => void;
}) {
  return (
    <div className="group absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-r-2xl border border-l-0 border-[#3440371f] bg-[#fffdf8ed] p-3 shadow-[0_10px_28px_rgba(48,58,47,0.1)]">
      <div className="mx-auto mb-2 grid h-6 w-6 place-items-center rounded-full bg-[#355f49] text-xs font-bold text-white">
        {nodes.length}
      </div>
      <div className="[writing-mode:vertical-rl] text-xs font-medium tracking-[0.1em] text-[#53645a]">
        想法篮子
      </div>
      {nodes.length > 0 && (
        <div className="absolute left-14 top-1/2 hidden w-64 -translate-y-1/2 rounded-2xl border border-[#3440371f] bg-[#fffdf8] p-3 shadow-[0_18px_44px_rgba(50,56,45,0.12)] group-hover:block md:block">
          <div className="mb-2 text-xs font-semibold text-[#53645a]">已放一边</div>
          <div className="space-y-2">
            {nodes.slice(0, 3).map((node) => (
              <div key={node.id} className="rounded-xl bg-[#f5f2ea] p-2">
                <div className="text-xs font-semibold">{node.title}</div>
                <button
                  type="button"
                  onClick={() => onRestore(node.id)}
                  className="mt-2 text-[11px] font-medium text-[#355f49]"
                >
                  恢复
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
