"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type MutableRefObject } from "react";

import { BrainstormAgentResponseSchema } from "./agent-operations";
import { applyAgentResponseToIdeaTree } from "./apply-agent-operations";
import {
  buildBrainstormQuickActionRequest,
  type BrainstormQuickActionId,
} from "./brainstorm-quick-actions";
import { ClearVersionModal } from "./clear-version-modal";
import { IdeaBasket } from "./idea-basket";
import { IdeaTreeCanvas } from "./idea-tree-canvas";
import {
  canGenerateClearVersion,
  createInitialIdeaTreeState,
  getActiveNodes,
  getDriftNodeIds,
  getIdeaEdges,
  getParkedNodes,
  ideaTreeReducer,
  type IdeaTreeState,
} from "./idea-tree-reducer";
import {
  createIdeaTreeDb,
  loadIdeaTreeState,
  saveIdeaTreeState,
  type IdeaTreeDatabase,
} from "./idea-tree-storage";

function createDemoState(): IdeaTreeState {
  let state = createInitialIdeaTreeState(
    "idea-tree-demo",
    "想做一个让人把模糊想法想清楚的 AI 工具",
  );

  state = ideaTreeReducer(state, {
    type: "grow_from_node",
    nodeId: state.rootNodeId,
    ideas: [
      {
        title: "聊天式 brainstorm 助手",
        description: "容易回到普通 AI 对话，暂时不作为主产品。",
      },
      {
        title: "用一棵树表达想法如何发散和修剪",
        description: "节点是想法片段，用户通过剪枝和继续长来获得清晰。",
      },
      {
        title: "自动生成 PRD",
        description: "可以作为导出，但不应该成为默认目标。",
      },
    ],
    source: "ai",
  });

  const firstLayer = getActiveNodes(state).filter((node) => node.parentId === state.rootNodeId);
  const treeNode = firstLayer.find((node) => node.title.includes("一棵树"));
  const chatNode = firstLayer.find((node) => node.title.includes("聊天式"));
  const prdNode = firstLayer.find((node) => node.title.includes("PRD"));

  if (treeNode) {
    state = ideaTreeReducer(state, { type: "follow_direction", nodeId: treeNode.id });
    state = ideaTreeReducer(state, {
      type: "grow_from_node",
      nodeId: treeNode.id,
      ideas: [
        {
          title: "节点只承载短想法片段",
          description: "不预设用户、场景、痛点等固定类型。",
        },
        {
          title: "判断动作发生在节点上",
          description: "继续长、沿这条继续、放一边都贴着想法发生。",
        },
        {
          title: "清晰版本在有取舍后生成",
          description: "不是初始面板，而是一轮思考后的阶段性快照。",
        },
      ],
      source: "ai",
    });
  }

  if (chatNode) {
    state = ideaTreeReducer(state, {
      type: "park_node",
      nodeId: chatNode.id,
      reason: "容易回到普通 AI 对话",
    });
  }

  if (prdNode) {
    state = ideaTreeReducer(state, {
      type: "park_node",
      nodeId: prdNode.id,
      reason: "不是当前主目标",
    });
  }

  return state;
}

export function IdeaTreeWorkspace() {
  const initialState = useMemo(() => createDemoState(), []);
  const [state, dispatch] = useReducer(ideaTreeReducer, initialState);
  const [focusedNodeId, setFocusedNodeId] = useState(initialState.currentDirectionNodeId);
  const [message, setMessage] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const dbRef = useRef<IdeaTreeDatabase | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const nodes = useMemo(() => Object.values(state.nodes), [state.nodes]);
  const edges = useMemo(() => getIdeaEdges(state), [state]);
  const activeNodes = useMemo(() => getActiveNodes(state), [state]);
  const parkedNodes = useMemo(() => getParkedNodes(state), [state]);
  const driftNodeIds = useMemo(() => getDriftNodeIds(state), [state]);
  const focusedNode = focusedNodeId ? state.nodes[focusedNodeId] : null;
  const currentDirection = state.currentDirectionNodeId
    ? state.nodes[state.currentDirectionNodeId]
    : null;
  const canClear = canGenerateClearVersion(state);

  useEffect(() => {
    let cancelled = false;
    const db = getBrowserDb(dbRef);

    loadIdeaTreeState(db, initialState.treeId)
      .then((savedState) => {
        if (cancelled) return;
        if (savedState) {
          dispatch({ type: "replace_state", state: savedState });
          setFocusedNodeId(savedState.currentDirectionNodeId ?? savedState.focusedNodeId);
        }
        setStorageReady(true);
      })
      .catch(() => {
        if (!cancelled) setStorageReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [initialState.treeId]);

  useEffect(() => {
    if (!storageReady) return;
    const db = getBrowserDb(dbRef);
    void saveIdeaTreeState(db, state);
  }, [state, storageReady]);

  async function runAgent(userMessage: string, allowWebSearch = false) {
    if (agentLoading) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAgentLoading(true);

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          state,
          focusedNodeId: focusedNodeId ?? state.focusedNodeId,
          userMessage,
          allowWebSearch,
        }),
      });
      const body = await response.json();

      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? body.error ?? "AI 暂时不可用。");
      }

      const agentResponse = BrainstormAgentResponseSchema.parse(body.response);
      const result = applyAgentResponseToIdeaTree(state, agentResponse);
      const nextState = ideaTreeReducer(result.state, {
        type: "record_agent_run",
        userMessage,
        agentMessage: agentResponse.message,
        operationTypes: agentResponse.operations.map((operation) => operation.type),
        appliedOperationTypes: result.appliedOperations,
        ignoredOperationTypes: result.ignoredOperations,
      });

      dispatch({ type: "replace_state", state: nextState });
      setFocusedNodeId(nextState.currentDirectionNodeId ?? nextState.focusedNodeId);

      if (nextState.clearVersions.length > state.clearVersions.length) {
        setClearOpen(true);
      }
    } catch {
      // intentionally silent — UI only signals loading state
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setAgentLoading(false);
    }
  }

  function handleFollow(nodeId: string) {
    dispatch({ type: "follow_direction", nodeId });
    setFocusedNodeId(nodeId);
  }

  function handlePark(nodeId: string) {
    dispatch({ type: "park_node", nodeId });
    if (focusedNodeId === nodeId) {
      setFocusedNodeId(state.rootNodeId);
    }
  }

  function handleRestore(nodeId: string) {
    dispatch({ type: "restore_node", nodeId });
    setFocusedNodeId(nodeId);
  }

  function handleUndo() {
    const next = ideaTreeReducer(state, { type: "undo_last_action" });
    dispatch({ type: "replace_state", state: next });
    setFocusedNodeId(next.currentDirectionNodeId ?? next.focusedNodeId);
  }

  function handleSendMessage() {
    const trimmed = message.trim();
    if (!trimmed || agentLoading) return;
    setMessage("");
    void runAgent(trimmed, shouldAllowWebSearch(trimmed));
  }

  function handleFocusedQuickAction(actionId: BrainstormQuickActionId) {
    if (agentLoading) return;
    const request = buildBrainstormQuickActionRequest(actionId, {
      focusedNodeTitle: focusedNode?.title ?? null,
      currentDirectionTitle: currentDirection?.title ?? null,
      parkedNodeCount: parkedNodes.length,
    });
    void runAgent(request.userMessage, request.allowWebSearch);
  }

  function handleAcceptNodeEdit(
    card: Extract<AgentContextCard, { type: "node_edit_suggestion" }>,
  ) {
    dispatch({
      type: "edit_node",
      nodeId: card.nodeId,
      title: card.title,
      description: card.description,
    });
    setAgentCards((cards) => cards.filter((item) => item !== card));
    setFocusedNodeId(card.nodeId);
  }

  return (
    <main className="grid h-screen grid-cols-1 overflow-hidden bg-[#f5f2ea] text-[#1d2520]">
      <section
        className="relative overflow-hidden bg-[radial-gradient(circle,rgba(70,94,78,0.13)_1px,transparent_1px),linear-gradient(180deg,#f1f4eb,#edf1e7)] bg-[length:26px_26px,auto]"
        aria-label="Idea Tree workspace"
      >
        <WorkspaceTopbar
          activeCount={activeNodes.length}
          parkedCount={parkedNodes.length}
          canUndo={state.actions.length > 0}
          onUndo={handleUndo}
        />

        <IdeaTreeCanvas
          nodes={nodes}
          edges={edges}
          driftNodeIds={driftNodeIds}
          focusedNode={focusedNode}
          focusedNodeId={focusedNodeId}
          currentDirectionNodeId={state.currentDirectionNodeId}
          agentLoading={agentLoading}
          onFocusNode={setFocusedNodeId}
          onGrowFocused={() =>
            focusedNode &&
            void runAgent(`围绕「${focusedNode.title}」继续长出 3-5 个不同但相关的子想法。`)
          }
          onFollowFocused={() => focusedNode && handleFollow(focusedNode.id)}
          onParkFocused={() => focusedNode && handlePark(focusedNode.id)}
          onFocusedQuickAction={handleFocusedQuickAction}
        />

        <IdeaBasket nodes={parkedNodes} onRestore={handleRestore} />

        <ParkedSummaryCard nodes={parkedNodes} />

        {canClear && (
          <ClearVersionTriggerCard
            disabled={agentLoading}
            onTrigger={() =>
              void runAgent("基于当前方向和已经放一边的想法，生成一版阶段性的清晰版本。")
            }
          />
        )}

        <div className="absolute bottom-6 left-1/2 z-10 flex w-[min(720px,calc(100%-48px))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#3440371f] bg-[#fffdf8e8] px-4 py-3 shadow-[0_16px_40px_rgba(48,58,47,0.12)] backdrop-blur">
          <span className="shrink-0 rounded-full bg-[#edf1e7] px-3 py-1 text-xs font-medium text-[#53645a]">
            问 AI
          </span>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSendMessage();
            }}
            disabled={agentLoading}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8b948c] disabled:opacity-60"
            placeholder="比如：从用户视角换一个角度继续想，或调研一下类似的案例"
            aria-label="问 AI"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={agentLoading || !message.trim()}
            className="grid h-9 w-9 place-items-center rounded-full bg-[#355f49] text-white disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="发送"
          >
            {agentLoading ? "…" : "↑"}
          </button>
        </div>
      </section>

      {clearOpen && (
        <ClearVersionModal
          state={state}
          currentDirection={currentDirection}
          parkedNodes={parkedNodes}
          onClose={() => setClearOpen(false)}
        />
      )}
    </main>
  );
}

function getBrowserDb(dbRef: MutableRefObject<IdeaTreeDatabase | null>) {
  if (!dbRef.current) {
    dbRef.current = createIdeaTreeDb();
  }

  return dbRef.current;
}

function shouldAllowWebSearch(input: string) {
  return /搜索|调研|案例|资料|趋势|事实|竞品|新闻|市场|论文|benchmark|research/i.test(input);
}

function WorkspaceTopbar({
  activeCount,
  parkedCount,
  canUndo,
  onUndo,
}: {
  activeCount: number;
  parkedCount: number;
  canUndo: boolean;
  onUndo: () => void;
}) {
  return (
    <div className="absolute left-6 right-6 top-5 z-10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative h-8 w-8 rounded-[50%_50%_45%_45%] border-2 border-[#355f49] bg-[#eef4e8] after:absolute after:left-[13px] after:top-[25px] after:h-4 after:w-0.5 after:rounded after:bg-[#355f49]" />
        <div>
          <strong className="block text-[17px] leading-none">Idea Tree</strong>
          <span className="mt-1 block text-[11px] uppercase tracking-[0.12em] text-[#667168]">
            brainstorm partner
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-full border border-[#3440371f] bg-[#fffdf8bd] px-3 py-2 text-xs font-medium text-[#53645a] shadow-[0_8px_24px_rgba(40,48,40,0.08)] backdrop-blur disabled:cursor-not-allowed disabled:opacity-45"
        >
          撤销
        </button>
        <div className="rounded-full border border-[#3440371f] bg-[#fffdf8bd] px-3 py-2 text-xs text-[#667168] shadow-[0_8px_24px_rgba(40,48,40,0.08)] backdrop-blur">
          树上做判断 · {activeCount} 个活跃想法 · {parkedCount} 个放一边
        </div>
      </div>
    </div>
  );
}

function ParkedSummaryCard({ nodes }: { nodes: Array<{ id: string; title: string }> }) {
  if (nodes.length === 0) return null;
  return (
    <div className="absolute right-6 top-[88px] z-10 max-w-[260px] rounded-2xl border border-[#3440371a] bg-[#fffdf8e8] px-4 py-3 shadow-[0_8px_24px_rgba(40,48,40,0.08)] backdrop-blur">
      <h3 className="text-xs font-semibold text-[#53645a]">已放一边</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-[#667168]">
        {nodes.map((node) => node.title).join("、")}。
      </p>
    </div>
  );
}

function ClearVersionTriggerCard({
  disabled,
  onTrigger,
}: {
  disabled: boolean;
  onTrigger: () => void;
}) {
  return (
    <div className="absolute right-6 top-[200px] z-10 max-w-[260px] rounded-2xl border border-[#355f4933] bg-[#eef4e8e6] px-4 py-3 shadow-[0_8px_24px_rgba(40,48,40,0.08)] backdrop-blur">
      <h3 className="text-xs font-semibold">可以收一下了</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-[#53645a]">
        已有当前方向和取舍痕迹，可以生成一版阶段性的清晰版本。
      </p>
      <button
        type="button"
        onClick={onTrigger}
        disabled={disabled}
        className="mt-2 rounded-full bg-[#355f49] px-3 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        生成清晰版本
      </button>
    </div>
  );
}
