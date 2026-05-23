import type { CSSProperties } from "react";
import type { IdeaNode } from "./idea-tree-reducer";

const LEAF_RADIUS = "76% 24% 70% 30% / 42% 58% 42% 58%";
const ROOT_BG = "linear-gradient(135deg, #3f6450 0%, #5e8367 100%)";
const LEAF_BG = "linear-gradient(135deg, #ffffff 0%, #fcfbf6 100%)";
const DRIFT_BG = "#fcfbf6";

export function IdeaNodeCard({
  node,
  focused,
  current,
  drift,
  onFocus,
}: {
  node: IdeaNode;
  focused: boolean;
  current: boolean;
  drift: boolean;
  onFocus: () => void;
}) {
  const isRoot = node.parentId === null;
  const isParked = node.status === "parked";
  const showDrift = drift && !isParked && !isRoot;

  const cardStyle: CSSProperties = {
    left: node.x,
    top: node.y,
    borderRadius: LEAF_RADIUS,
    background: isRoot ? ROOT_BG : showDrift ? DRIFT_BG : LEAF_BG,
  };

  return (
    <button
      type="button"
      onClick={onFocus}
      style={cardStyle}
      className={[
        "absolute w-[272px] min-h-[128px] -translate-x-1/2 -translate-y-1/2 cursor-pointer border text-left shadow-[0_6px_18px_rgba(48,58,47,0.08)] transition pl-[36px] pr-[30px] pt-[26px] pb-[22px]",
        "hover:-translate-y-[calc(50%+2px)] hover:shadow-[0_18px_44px_rgba(50,56,45,0.12),0_2px_8px_rgba(50,56,45,0.06)]",
        isRoot
          ? "w-[300px] border-[#2c4a3a] text-white shadow-[0_10px_24px_-6px_rgba(35,70,50,0.28)]"
          : "border-[#3440371f]",
        current && !isRoot ? "!border-[#3f6450] shadow-[0_6px_18px_rgba(48,58,47,0.08),0_0_0_1px_#3f6450]" : "",
        focused ? "outline outline-2 outline-offset-[5px] outline-[#b6724294]" : "",
        showDrift ? "opacity-40 saturate-[0.55] hover:opacity-80 hover:saturate-[0.85]" : "",
        isParked ? "scale-90 opacity-35 grayscale" : "",
      ].join(" ")}
      aria-label={node.title}
    >
      {current && !isRoot && (
        <span
          aria-hidden="true"
          style={{ borderRadius: LEAF_RADIUS }}
          className="pointer-events-none absolute -inset-[7px] border border-dashed border-[#5e8367] opacity-55"
        />
      )}
      {current && !isRoot && (
        <span className="absolute -top-4 right-3 z-[1] rounded-full border border-[#b6724238] bg-[#f1dfca] px-2 py-1 text-[11px] font-semibold text-[#7a4525]">
          当前方向
        </span>
      )}
      <div
        className={[
          "relative mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.09em]",
          isRoot ? "text-white/70" : "text-[#8b948c]",
        ].join(" ")}
      >
        <span
          className={[
            "h-2 w-2 rounded-full",
            isRoot ? "bg-white/80" : node.source === "user" ? "bg-[#b67242]" : "bg-[#6f9a7a]",
          ].join(" ")}
        />
        {isRoot ? "root · 原始想法" : isParked ? "已放一边" : node.source === "ai" ? "AI 生成" : "你提出"}
      </div>
      <h3
        className={[
          "relative m-0 text-[15px] font-semibold leading-snug",
          isRoot ? "text-[17px] font-medium tracking-[-0.01em]" : "",
          current && !isRoot ? "text-[#1a2e23]" : "",
        ].join(" ")}
      >
        {node.title}
        {current && !isRoot && (
          <span className="ml-[7px] inline-block h-[6px] w-[6px] rounded-full bg-[#3f6450] align-[0.12em]" />
        )}
      </h3>
      {node.description && (
        <p
          className={[
            "relative mt-2 text-xs leading-relaxed",
            isRoot ? "text-white/75" : "text-[#667168]",
          ].join(" ")}
        >
          {node.description}
        </p>
      )}
    </button>
  );
}
