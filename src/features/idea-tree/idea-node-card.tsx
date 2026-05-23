import type { IdeaNode } from "./idea-tree-reducer";

export function IdeaNodeCard({
  node,
  focused,
  current,
  onFocus,
}: {
  node: IdeaNode;
  focused: boolean;
  current: boolean;
  onFocus: () => void;
}) {
  const isRoot = node.parentId === null;
  const isParked = node.status === "parked";

  return (
    <button
      type="button"
      onClick={onFocus}
      className={[
        "absolute w-[218px] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-[16px_28px_16px_28px/28px_16px_28px_16px] border border-[#3440371f] bg-[#fffdf8f2] p-4 text-left shadow-[0_6px_18px_rgba(48,58,47,0.08)] transition",
        "hover:-translate-y-[calc(50%+3px)] hover:shadow-[0_18px_44px_rgba(50,56,45,0.12),0_2px_8px_rgba(50,56,45,0.06)]",
        isRoot
          ? "w-[260px] rounded-[28px_28px_18px_18px/38px_38px_18px_18px] bg-[#355f49] text-white"
          : "",
        current ? "border-[#6f9a7a] ring-2 ring-[#6f9a7a47]" : "",
        focused ? "outline outline-2 outline-offset-[5px] outline-[#b6724294]" : "",
        isParked ? "scale-90 opacity-35 grayscale" : "",
      ].join(" ")}
      style={{ left: node.x, top: node.y }}
      aria-label={node.title}
    >
      {current && (
        <span className="absolute -top-4 right-3 rounded-full border border-[#b6724238] bg-[#f1dfca] px-2 py-1 text-[11px] font-semibold text-[#7a4525]">
          当前方向
        </span>
      )}
      <div
        className={[
          "mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.09em]",
          isRoot ? "text-white/70" : "text-[#8b948c]",
        ].join(" ")}
      >
        <span
          className={[
            "h-2 w-2 rounded-full",
            isRoot ? "bg-white/80" : "bg-[#6f9a7a]",
          ].join(" ")}
        />
        {isRoot ? "root · 原始想法" : isParked ? "已放一边" : node.source === "ai" ? "AI 生成" : "你提出"}
      </div>
      <h3
        className={["m-0 text-[15px] font-semibold leading-snug", isRoot ? "text-[17px]" : ""].join(
          " ",
        )}
      >
        {node.title}
      </h3>
      {node.description && (
        <p
          className={[
            "mt-2 text-xs leading-relaxed",
            isRoot ? "text-white/75" : "text-[#667168]",
          ].join(" ")}
        >
          {node.description}
        </p>
      )}
    </button>
  );
}
