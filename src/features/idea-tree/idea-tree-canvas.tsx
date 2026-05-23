import type { BrainstormQuickActionId } from "./brainstorm-quick-actions";
import { IdeaNodeCard } from "./idea-node-card";
import type { IdeaEdge, IdeaNode } from "./idea-tree-reducer";
import { NodeActions } from "./node-actions";

export function IdeaTreeCanvas({
  nodes,
  edges,
  driftNodeIds,
  focusedNode,
  focusedNodeId,
  currentDirectionNodeId,
  agentLoading,
  onFocusNode,
  onGrowFocused,
  onFollowFocused,
  onParkFocused,
  onFocusedQuickAction,
}: {
  nodes: IdeaNode[];
  edges: IdeaEdge[];
  driftNodeIds: Set<string>;
  focusedNode: IdeaNode | null;
  focusedNodeId: string | null;
  currentDirectionNodeId: string | null;
  agentLoading: boolean;
  onFocusNode: (nodeId: string) => void;
  onGrowFocused: () => void;
  onFollowFocused: () => void;
  onParkFocused: () => void;
  onFocusedQuickAction: (actionId: BrainstormQuickActionId) => void;
}) {
  return (
    <div className="absolute left-1/2 top-1/2 h-[1100px] w-[1400px] -translate-x-1/2 -translate-y-[58%]">
      <Connections nodes={nodes} edges={edges} driftNodeIds={driftNodeIds} />
      {nodes.map((node) => (
        <IdeaNodeCard
          key={node.id}
          node={node}
          focused={node.id === focusedNodeId}
          current={node.id === currentDirectionNodeId}
          drift={driftNodeIds.has(node.id)}
          onFocus={() => onFocusNode(node.id)}
        />
      ))}

      {focusedNode && focusedNode.status !== "parked" && (
        <NodeActions
          node={focusedNode}
          onGrow={onGrowFocused}
          onFollow={onFollowFocused}
          onPark={onParkFocused}
          onQuickAction={onFocusedQuickAction}
          disabled={agentLoading}
        />
      )}
    </div>
  );
}

function Connections({
  nodes,
  edges,
  driftNodeIds,
}: {
  nodes: IdeaNode[];
  edges: IdeaEdge[];
  driftNodeIds: Set<string>;
}) {
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-[1100px] w-[1400px] overflow-visible"
      aria-hidden="true"
    >
      {edges
        .map((edge) => {
          const parent = byId[edge.parentNodeId];
          const node = byId[edge.childNodeId];
          if (!node) return null;
          if (!parent) return null;
          const d = `M ${parent.x} ${parent.y - 64} C ${parent.x} ${(parent.y + node.y) / 2}, ${node.x} ${(parent.y + node.y) / 2}, ${node.x} ${node.y + 64}`;
          const isParked = node.status === "parked" || parent.status === "parked";
          const isDrift = driftNodeIds.has(node.id) || driftNodeIds.has(parent.id);
          const isCurrent = node.status === "current" || parent.status === "current";

          let stroke = "stroke-[#485b4e3d]";
          let dasharray: string | undefined = "4 7";
          let strokeWidth = 2;

          if (isParked) {
            stroke = "stroke-[#57574e24]";
          } else if (isDrift) {
            stroke = "stroke-[#485b4e26]";
            dasharray = "2 6";
            strokeWidth = 1.4;
          } else if (isCurrent) {
            stroke = "stroke-[#2c4a3a]";
            dasharray = undefined;
            strokeWidth = 3;
          }

          return (
            <path
              key={edge.id}
              d={d}
              className={stroke}
              fill="none"
              strokeWidth={strokeWidth}
              strokeDasharray={dasharray}
              strokeLinecap="round"
            />
          );
        })}
    </svg>
  );
}
