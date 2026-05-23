import { useRef, type CSSProperties, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import type { IdeaNode } from "./idea-tree-reducer";
import { NodeActions } from "./node-actions";

const DRAG_THRESHOLD_PX = 4;
const LEAF_RADIUS = "76% 24% 70% 30% / 42% 58% 42% 58%";
const ROOT_RADIUS = "60% 40% 60% 40% / 50% 50% 50% 50%";

export type IdeaNodeCardActions = {
  onEnterGrowMode: () => void;
  onFavorite: () => void;
  onUnfavorite: () => void;
  onPark: () => void;
  onRestore: () => void;
  onClose: () => void;
  growDisabled: boolean;
};

export function IdeaNodeCard({
  node,
  focused,
  favorited,
  onFocus,
  onMove,
  focusedActions,
  zoomRef,
}: {
  node: IdeaNode;
  focused: boolean;
  favorited: boolean;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  focusedActions?: IdeaNodeCardActions | null;
  zoomRef: MutableRefObject<number>;
}) {
  const isRoot = node.parentId === null;
  const isParked = node.status === "parked";

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
      return;
    }
    drag.moved = true;
    const scale = zoomRef.current || 1;
    onMove(drag.originX + dx / scale, drag.originY + dy / scale);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!moved) {
      onFocus();
    }
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const cardStyle: CSSProperties = {
    borderRadius: isRoot ? ROOT_RADIUS : LEAF_RADIUS,
    background: isRoot
      ? "linear-gradient(135deg, var(--green-500) 0%, var(--green-400) 100%)"
      : "var(--paper)",
    borderColor: favorited
      ? "var(--warm-edge)"
      : isRoot
        ? "var(--green-600)"
        : "var(--paper-edge)",
    boxShadow: favorited
      ? "var(--shadow-md), 0 0 0 1px var(--warm-edge)"
      : "var(--shadow-md)",
    touchAction: "none",
  };

  const metaLabel = isParked ? "已放一边" : isRoot ? "根题 · 你的出发点" : null;

  return (
    <div
      className={[
        "absolute -translate-x-1/2 -translate-y-1/2",
        focused ? "z-20" : "z-0",
      ].join(" ")}
      style={{ left: node.x, top: node.y }}
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={cardStyle}
        className={[
          "relative block w-[260px] min-h-[112px] cursor-grab active:cursor-grabbing border text-left transition pl-[36px] pr-[30px] pt-[26px] pb-[22px] select-none",
          "hover:-translate-y-[2px]",
          isRoot ? "w-[284px] text-white" : "",
          focused ? "outline outline-2 outline-offset-[5px] outline-[color:var(--warm-edge)]" : "",
          isParked ? "scale-95 opacity-40 saturate-[0.55] hover:opacity-65" : "",
        ].join(" ")}
        aria-label={node.title}
      >
        {favorited && (
          <span
            className="absolute -top-2.5 right-3 z-[1] rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: "var(--warm-soft)",
              borderColor: "var(--warm-edge)",
              color: "var(--warm)",
            }}
          >
            ✦ 收藏
          </span>
        )}
        {metaLabel && (
          <div
            className="relative mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.09em]"
            style={{ color: isRoot ? "rgba(255,255,255,0.75)" : "var(--ink-mute)" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isRoot ? "rgba(255,255,255,0.85)" : "var(--ink-mute)",
              }}
            />
            {metaLabel}
          </div>
        )}
        <h3
          className={[
            "relative m-0 text-[15px] font-semibold leading-snug",
            isRoot ? "text-[17px] font-medium tracking-[-0.01em]" : "",
          ].join(" ")}
          style={{ color: isRoot ? "#fff" : "var(--ink)" }}
        >
          {node.title}
        </h3>
        {node.description && (
          <p
            className="relative mt-2 text-xs leading-relaxed"
            style={{ color: isRoot ? "rgba(255,255,255,0.78)" : "var(--ink-soft)" }}
          >
            {node.description}
          </p>
        )}
      </button>
      {focused && focusedActions && (
        <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap">
          <NodeActions
            node={node}
            favorited={favorited}
            onEnterGrowMode={focusedActions.onEnterGrowMode}
            onFavorite={focusedActions.onFavorite}
            onUnfavorite={focusedActions.onUnfavorite}
            onPark={focusedActions.onPark}
            onRestore={focusedActions.onRestore}
            onClose={focusedActions.onClose}
            growDisabled={focusedActions.growDisabled}
          />
        </div>
      )}
    </div>
  );
}
