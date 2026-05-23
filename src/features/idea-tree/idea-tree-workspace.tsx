"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type MutableRefObject } from "react";

import { BrainstormAgentResponseSchema } from "./agent-operations";
import { applyAgentResponseToIdeaTree, type AgentContextCard } from "./apply-agent-operations";
import { ClearVersionModal } from "./clear-version-modal";
import { ContextChatPanel } from "./context-chat-panel";
import { IdeaBasket } from "./idea-basket";
import { IdeaTreeCanvas } from "./idea-tree-canvas";
import {
  canGenerateClearVersion,
  createInitialIdeaTreeState,
  getActiveNodes,
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

type PendingAgentRequest = {
  userMessage: string;
  allowWebSearch: boolean;
};

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
  const [seedThought, setSeedThought] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentMessage, setAgentMessage] = useState(
    "我会围绕这棵树继续帮你发散和剪枝。已放一边的想法不会主动绕回，除非你把它恢复。",
  );
  const [agentCards, setAgentCards] = useState<AgentContextCard[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [lastAgentRequest, setLastAgentRequest] = useState<PendingAgentRequest | null>(null);
  const dbRef = useRef<IdeaTreeDatabase | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const nodes = useMemo(() => Object.values(state.nodes), [state.nodes]);
  const edges = useMemo(() => getIdeaEdges(state), [state]);
  const activeNodes = useMemo(() => getActiveNodes(state), [state]);
  const parkedNodes = useMemo(() => getParkedNodes(state), [state]);
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
    const pendingRequest = { userMessage, allowWebSearch };

    setAgentLoading(true);
    setAgentError(null);
    setLastAgentRequest(pendingRequest);

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
      setAgentMessage(agentResponse.message);
      setAgentCards(result.cards);
      setLastAgentRequest(null);

      if (nextState.clearVersions.length > state.clearVersions.length) {
        setClearOpen(true);
      }

      if (result.ignoredOperations.length > 0) {
        setAgentError(`有 ${result.ignoredOperations.length} 个 AI 操作因为不符合当前树状态被忽略。`);
      }
    } catch (error) {
      setAgentError(isAbortError(error) ? "已取消这次 AI 操作。" : error instanceof Error ? error.message : "AI 暂时不可用。");
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setAgentLoading(false);
    }
  }

  function handleCancelAgent() {
    abortControllerRef.current?.abort();
  }

  function handleRetryAgent() {
    if (!lastAgentRequest) return;
    void runAgent(lastAgentRequest.userMessage, lastAgentRequest.allowWebSearch);
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

  function handleAddSeedThought() {
    const trimmed = seedThought.trim();
    if (!trimmed) return;
    dispatch({ type: "add_seed_thought", title: trimmed });
    setSeedThought("");
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
    <main className="grid h-screen grid-cols-[minmax(0,1fr)_360px] overflow-hidden bg-[#f5f2ea] text-[#1d2520]">
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
          focusedNode={focusedNode}
          focusedNodeId={focusedNodeId}
          currentDirectionNodeId={state.currentDirectionNodeId}
          onFocusNode={setFocusedNodeId}
          onGrowFocused={() =>
            focusedNode &&
            void runAgent(`围绕「${focusedNode.title}」继续长出 3-5 个不同但相关的子想法。`)
          }
          onFollowFocused={() => focusedNode && handleFollow(focusedNode.id)}
          onParkFocused={() => focusedNode && handlePark(focusedNode.id)}
        />

        <IdeaBasket nodes={parkedNodes} onRestore={handleRestore} />

        <div className="absolute bottom-6 left-1/2 z-10 flex w-[min(720px,calc(100%-48px))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#3440371f] bg-[#fffdf8e8] px-4 py-3 shadow-[0_16px_40px_rgba(48,58,47,0.12)] backdrop-blur">
          <span className="shrink-0 rounded-full bg-[#edf1e7] px-3 py-1 text-xs font-medium text-[#53645a]">
            补一句想法
          </span>
          <input
            value={seedThought}
            onChange={(event) => setSeedThought(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAddSeedThought();
            }}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8b948c]"
            placeholder="比如：我想让它更像一个思考伙伴，而不是聊天工具"
            aria-label="补一句想法"
          />
          <button
            type="button"
            onClick={handleAddSeedThought}
            className="grid h-9 w-9 place-items-center rounded-full bg-[#355f49] text-white"
            aria-label="添加想法"
          >
            ↑
          </button>
        </div>
      </section>

      <ContextChatPanel
        currentDirection={currentDirection}
        focusedNode={focusedNode}
        parkedNodes={parkedNodes}
        actionCount={state.actions.length}
        canClear={canClear}
        agentMessage={agentMessage}
        agentCards={agentCards}
        agentError={agentError}
        agentLoading={agentLoading}
        onAskAgent={(message, allowWebSearch) => void runAgent(message, allowWebSearch)}
        onCancelAgent={handleCancelAgent}
        onRetryAgent={lastAgentRequest ? handleRetryAgent : null}
        onGrowFocused={() =>
          focusedNode &&
          void runAgent(`围绕「${focusedNode.title}」继续长出 3-5 个不同但相关的子想法。`)
        }
        onFollowFocused={() => focusedNode && handleFollow(focusedNode.id)}
        onParkFocused={() => focusedNode && handlePark(focusedNode.id)}
        onCreateClearVersion={() => void runAgent("基于当前方向和已经放一边的想法，生成一版阶段性的清晰版本。")}
        onAcceptNodeEdit={handleAcceptNodeEdit}
      />

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

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
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
