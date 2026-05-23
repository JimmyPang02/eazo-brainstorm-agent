import type { MutableRefObject } from "react";

import { IdeaNodeCard } from "./idea-node-card";
import type { IdeaEdge, IdeaNode } from "./idea-tree-reducer";

export type PendingFanOut = {
  runId: string;
  parent: IdeaNode;
  skeletonOffsets: number[];
};

export function IdeaTreeCanvas({
  nodes,
  edges,
  favoritedNodeIds,
  focusedNode,
  focusedNodeId,
  busyParentIds,
  pendingFanOuts,
  panX,
  panY,
  zoom,
  zoomRef,
  onFocusNode,
  onMoveNode,
  onEnterGrowMode,
  onFavorite,
  onUnfavorite,
  onPark,
  onRestore,
  onCloseFocused,
}: {
  nodes: IdeaNode[];
  edges: IdeaEdge[];
  favoritedNodeIds: Set<string>;
  focusedNode: IdeaNode | null;
  focusedNodeId: string | null;
  busyParentIds: Set<string>;
  pendingFanOuts: PendingFanOut[];
  panX: number;
  panY: number;
  zoom: number;
  zoomRef: MutableRefObject<number>;
  onFocusNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onEnterGrowMode: (nodeId: string) => void;
  onFavorite: (nodeId: string) => void;
  onUnfavorite: (nodeId: string) => void;
  onPark: (nodeId: string) => void;
  onRestore: (nodeId: string) => void;
  onCloseFocused: () => void;
}) {
  const focusedNodeBusy = focusedNode ? busyParentIds.has(focusedNode.id) : false;

  return (
    <div
      className="absolute left-1/2 top-1/2 h-[1100px] w-[1400px]"
      style={{
        transform: `translate(${panX}px, ${panY}px) scale(${zoom}) translate(-50%, -58%)`,
        transformOrigin: "0 0",
        willChange: "transform",
      }}
    >
      <Connections nodes={nodes} edges={edges} />
      {pendingFanOuts.map((entry) =>
        entry.parent.status === "active" ? (
          <SkeletonFanOut
            key={entry.runId}
            parent={entry.parent}
            offsets={entry.skeletonOffsets}
          />
        ) : null,
      )}
      {nodes.map((node) => {
        const isFocused = node.id === focusedNodeId;
        return (
          <IdeaNodeCard
            key={node.id}
            node={node}
            focused={isFocused}
            favorited={favoritedNodeIds.has(node.id)}
            zoomRef={zoomRef}
            onFocus={() => onFocusNode(node.id)}
            onMove={(x, y) => onMoveNode(node.id, x, y)}
            focusedActions={
              isFocused
                ? {
                    onEnterGrowMode: () => onEnterGrowMode(node.id),
                    onFavorite: () => onFavorite(node.id),
                    onUnfavorite: () => onUnfavorite(node.id),
                    onPark: () => onPark(node.id),
                    onRestore: () => onRestore(node.id),
                    onClose: onCloseFocused,
                    growDisabled: focusedNodeBusy,
                  }
                : null
            }
          />
        );
      })}
    </div>
  );
}

const SKELETON_Y_OFFSET = 200;

function SkeletonFanOut({ parent, offsets }: { parent: IdeaNode; offsets: number[] }) {
  const baseY = parent.y - SKELETON_Y_OFFSET;
  return (
    <>
      {offsets.map((dx, index) => {
        const x = parent.x + dx;
        const y = baseY;
        const d = `M ${parent.x} ${parent.y - 64} C ${parent.x} ${(parent.y + y) / 2}, ${x} ${(parent.y + y) / 2}, ${x} ${y + 64}`;
        return (
          <SkeletonNodeCard
            key={`skeleton-${parent.id}-${index}`}
            x={x}
            y={y}
            connectorPath={d}
            delay={index * 120}
          />
        );
      })}
    </>
  );
}

function SkeletonNodeCard({
  x,
  y,
  connectorPath,
  delay,
}: {
  x: number;
  y: number;
  connectorPath: string;
  delay: number;
}) {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-[1100px] w-[1400px] overflow-visible"
        aria-hidden="true"
      >
        <path
          d={connectorPath}
          fill="none"
          stroke="rgba(72,91,78,0.22)"
          strokeWidth={1.4}
          strokeDasharray="3 6"
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute w-[260px] min-h-[112px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-2 border-dashed animate-pulse"
        style={{
          left: x,
          top: y,
          borderColor: "var(--paper-edge)",
          background: "rgba(255,255,255,0.45)",
          animationDelay: `${delay}ms`,
          borderRadius: "76% 24% 70% 30% / 42% 58% 42% 58%",
        }}
        aria-hidden
      >
        <div className="flex h-full flex-col gap-2 px-[36px] py-[28px]">
          <div
            className="h-3 w-2/3 rounded-full"
            style={{ background: "var(--paper-edge)" }}
          />
          <div
            className="h-2 w-full rounded-full"
            style={{ background: "var(--paper-edge)", opacity: 0.55 }}
          />
          <div
            className="h-2 w-4/5 rounded-full"
            style={{ background: "var(--paper-edge)", opacity: 0.45 }}
          />
        </div>
      </div>
    </>
  );
}

function Connections({ nodes, edges }: { nodes: IdeaNode[]; edges: IdeaEdge[] }) {
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-[1100px] w-[1400px] overflow-visible"
      aria-hidden="true"
    >
      {edges.map((edge) => {
        const parent = byId[edge.parentNodeId];
        const node = byId[edge.childNodeId];
        if (!node || !parent) return null;
        const d = `M ${parent.x} ${parent.y - 64} C ${parent.x} ${(parent.y + node.y) / 2}, ${node.x} ${(parent.y + node.y) / 2}, ${node.x} ${node.y + 64}`;
        const isParked = node.status === "parked" || parent.status === "parked";

        return (
          <path
            key={edge.id}
            d={d}
            fill="none"
            stroke={isParked ? "rgba(72,91,78,0.18)" : "rgba(72,91,78,0.35)"}
            strokeWidth={isParked ? 1.4 : 2}
            strokeDasharray={isParked ? "2 6" : "4 7"}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
