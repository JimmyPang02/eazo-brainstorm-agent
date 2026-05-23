import { IdeaNodeCard } from "./idea-node-card";
import type { IdeaEdge, IdeaNode } from "./idea-tree-reducer";
import { NodeActions } from "./node-actions";

export function IdeaTreeCanvas({
  nodes,
  edges,
  focusedNode,
  focusedNodeId,
  currentDirectionNodeId,
  onFocusNode,
  onGrowFocused,
  onFollowFocused,
  onParkFocused,
}: {
  nodes: IdeaNode[];
  edges: IdeaEdge[];
  focusedNode: IdeaNode | null;
  focusedNodeId: string | null;
  currentDirectionNodeId: string | null;
  onFocusNode: (nodeId: string) => void;
  onGrowFocused: () => void;
  onFollowFocused: () => void;
  onParkFocused: () => void;
}) {
  return (
    <div className="absolute left-1/2 top-1/2 h-[660px] w-[960px] -translate-x-[54%] -translate-y-[46%]">
      <Connections nodes={nodes} edges={edges} />
      {nodes.map((node) => (
        <IdeaNodeCard
          key={node.id}
          node={node}
          focused={node.id === focusedNodeId}
          current={node.id === currentDirectionNodeId}
          onFocus={() => onFocusNode(node.id)}
        />
      ))}

      {focusedNode && focusedNode.status !== "parked" && (
        <NodeActions
          node={focusedNode}
          onGrow={onGrowFocused}
          onFollow={onFollowFocused}
          onPark={onParkFocused}
        />
      )}
    </div>
  );
}

function Connections({ nodes, edges }: { nodes: IdeaNode[]; edges: IdeaEdge[] }) {
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-[660px] w-[960px] overflow-visible"
      aria-hidden="true"
    >
      {edges
        .map((edge) => {
          const parent = byId[edge.parentNodeId];
          const node = byId[edge.childNodeId];
          if (!node) return null;
          if (!parent) return null;
          const d = `M ${parent.x} ${parent.y - 44} C ${parent.x} ${(parent.y + node.y) / 2}, ${node.x} ${(parent.y + node.y) / 2}, ${node.x} ${node.y + 44}`;
          const active = node.status !== "parked" && parent.status !== "parked";
          const current = node.status === "current" || parent.status === "current";

          return (
            <path
              key={edge.id}
              d={d}
              className={current ? "stroke-[#355f49]" : active ? "stroke-[#485b4e3d]" : "stroke-[#57574e24]"}
              fill="none"
              strokeWidth={current ? 4 : 2}
              strokeDasharray={current ? undefined : "4 7"}
              strokeLinecap="round"
            />
          );
        })}
    </svg>
  );
}
