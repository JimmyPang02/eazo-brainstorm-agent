"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { CircleUserRound, FilePlus, History, Loader2, Minus, Plus, RotateCcw, Telescope } from "lucide-react";
import { toast } from "sonner";

import { AboutYouPanel } from "./about-you-panel";
import { BrandMark } from "./brand-mark";
import { BrainstormAgentResponseSchema } from "./agent-operations";
import { applyAgentResponseToIdeaTree } from "./apply-agent-operations";
import {
  BRAINSTORM_QUICK_ACTIONS,
  buildBrainstormQuickActionRequest,
  type BrainstormQuickActionId,
} from "./brainstorm-quick-actions";
import { CanvasManagerPanel } from "./canvas-manager-panel";
import { ClearVersionModal } from "./clear-version-modal";
import { useConfirm } from "./confirm-dialog";
import { IdeaBasket } from "./idea-basket";
import { IdeaTreeCanvas, type PendingFanOut } from "./idea-tree-canvas";
import {
  computeChildXOffsets,
  createEmptyIdeaTreeState,
  getFavoritedNodes,
  getIdeaEdges,
  getLayerByNodeId,
  getParkedNodes,
  hasRoot,
  ideaTreeReducer,
  type IdeaNode,
  type IdeaTreeState,
} from "./idea-tree-reducer";
import {
  createIdeaTreeDb,
  createStoredTree,
  clearIdeaTreeState,
  listStoredTrees,
  loadIdeaTreeState,
  renameStoredTree,
  saveIdeaTreeState,
  type IdeaTreeDatabase,
  type StoredTreeSummary,
} from "./idea-tree-storage";

const DEFAULT_TREE_ID = "idea-tree-demo";
const ACTIVE_TREE_STORAGE_KEY = "eazo:idea-tree:active";
const CONVERGE_LAYER_THRESHOLD = 3;
const SKELETON_PLACEHOLDER_COUNT = 4;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2;
const ZOOM_STEP = 1.15;

type RunKind = "grow" | "converge" | "general";

type RunState = {
  id: string;
  parentNodeId: string | null;
  controller: AbortController;
  kind: RunKind;
};

function readStoredActiveTreeId(): string {
  if (typeof window === "undefined") return DEFAULT_TREE_ID;
  try {
    return window.localStorage.getItem(ACTIVE_TREE_STORAGE_KEY) ?? DEFAULT_TREE_ID;
  } catch {
    return DEFAULT_TREE_ID;
  }
}

function persistActiveTreeId(treeId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_TREE_STORAGE_KEY, treeId);
  } catch {
    // ignore quota / disabled storage
  }
}

function generateTreeId(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().split("-")[0]
      : Math.random().toString(36).slice(2, 10);
  return `idea-tree-${random}`;
}

export function IdeaTreeWorkspace() {
  const [activeTreeId, setActiveTreeId] = useState<string>(() => readStoredActiveTreeId());
  const [state, dispatch] = useReducer(
    ideaTreeReducer,
    activeTreeId,
    (id) => createEmptyIdeaTreeState(id),
  );
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [growFromNodeId, setGrowFromNodeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [runs, setRuns] = useState<Map<string, RunState>>(() => new Map());
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [trees, setTrees] = useState<StoredTreeSummary[]>([]);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const dbRef = useRef<IdeaTreeDatabase | null>(null);
  const stateRef = useRef(state);
  const runsRef = useRef(runs);
  const sectionRef = useRef<HTMLElement | null>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const applyZoom = useCallback(
    (nextZoomRaw: number, anchorScreenX?: number, anchorScreenY?: number) => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const anchorX = anchorScreenX ?? rect.left + rect.width / 2;
      const anchorY = anchorScreenY ?? rect.top + rect.height / 2;
      const z = zoomRef.current;
      const zNext = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoomRaw));
      if (zNext === z) return;
      const A = anchorX - (rect.left + rect.width / 2);
      const B = anchorY - (rect.top + rect.height / 2);
      const ratio = zNext / z;
      const prevPan = panRef.current;
      const nextPan = {
        x: prevPan.x * ratio + A * (1 - ratio),
        y: prevPan.y * ratio + B * (1 - ratio),
      };
      zoomRef.current = zNext;
      panRef.current = nextPan;
      setZoom(zNext);
      setPan(nextPan);
    },
    [],
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    function handleWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      applyZoom(zoomRef.current * factor, event.clientX, event.clientY);
    }
    section.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      section.removeEventListener("wheel", handleWheel);
    };
  }, [applyZoom]);

  const rootSeeded = hasRoot(state);
  const nodes = useMemo(() => Object.values(state.nodes), [state.nodes]);
  const edges = useMemo(() => getIdeaEdges(state), [state]);
  const parkedNodes = useMemo(() => getParkedNodes(state), [state]);
  const favoritedNodes = useMemo(() => getFavoritedNodes(state), [state]);
  const layerByNodeId = useMemo(() => getLayerByNodeId(state), [state]);
  const favoritedNodeIds = useMemo(
    () => new Set(favoritedNodes.map((node) => node.id)),
    [favoritedNodes],
  );
  const maxLayer = useMemo(() => {
    let max = 0;
    for (const layer of layerByNodeId.values()) {
      if (layer > max) max = layer;
    }
    return max;
  }, [layerByNodeId]);
  const anyRunning = runs.size > 0;
  const convergeRunning = useMemo(
    () => [...runs.values()].some((run) => run.kind === "converge"),
    [runs],
  );
  const busyParentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of runs.values()) {
      if (run.parentNodeId) ids.add(run.parentNodeId);
    }
    return ids;
  }, [runs]);
  const pendingFanOuts: PendingFanOut[] = useMemo(() => {
    const entries: PendingFanOut[] = [];
    for (const run of runs.values()) {
      if (!run.parentNodeId) continue;
      const parent = state.nodes[run.parentNodeId];
      if (!parent || parent.status === "parked") continue;
      const existingChildren = Object.values(state.nodes).filter(
        (node) => node.parentId === parent.id && node.status === "active",
      );
      const totalChildren = existingChildren.length + SKELETON_PLACEHOLDER_COUNT;
      const offsets = computeChildXOffsets(parent, totalChildren);
      entries.push({
        runId: run.id,
        parent,
        skeletonOffsets: offsets.slice(existingChildren.length),
      });
    }
    return entries;
  }, [runs, state]);
  const canConverge = rootSeeded && !convergeRunning && maxLayer >= CONVERGE_LAYER_THRESHOLD;
  const focusedNode = focusedNodeId ? state.nodes[focusedNodeId] ?? null : null;
  const growFromNode: IdeaNode | null = growFromNodeId
    ? state.nodes[growFromNodeId] ?? null
    : null;

  const refreshTrees = useCallback(async () => {
    const db = getBrowserDb(dbRef);
    try {
      const summaries = await listStoredTrees(db);
      setTrees(summaries);
    } catch {
      // ignore — UI will retry on next interaction
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const db = getBrowserDb(dbRef);

    async function bootstrap() {
      const summaries = await listStoredTrees(db);
      if (cancelled) return;

      let targetId = activeTreeId;
      const hasActiveInDb = summaries.some((tree) => tree.treeId === targetId);
      if (!hasActiveInDb && summaries.length > 0) {
        targetId = summaries[0].treeId;
        setActiveTreeId(targetId);
        persistActiveTreeId(targetId);
      }

      const loaded = await loadIdeaTreeState(db, targetId);
      if (cancelled) return;

      if (loaded) {
        dispatch({ type: "replace_state", state: loaded });
        stateRef.current = loaded;
      } else {
        const fresh = createEmptyIdeaTreeState(targetId);
        dispatch({ type: "replace_state", state: fresh });
        stateRef.current = fresh;
      }

      setTrees(summaries);
      setStorageReady(true);
    }

    bootstrap().catch(() => {
      if (!cancelled) setStorageReady(true);
    });

    return () => {
      cancelled = true;
    };
    // Bootstrap once on mount. Subsequent canvas switches go through their handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    if (Object.keys(state.nodes).length === 0) return;
    const db = getBrowserDb(dbRef);
    void saveIdeaTreeState(db, state).then(() => {
      void refreshTrees();
    });
  }, [state, storageReady, refreshTrees]);

  async function runAgent(
    userMessage: string,
    allowWebSearch = false,
    override?: { state: IdeaTreeState; focusedNodeId: string },
    options?: { parentNodeId?: string; kind?: RunKind },
  ) {
    const runId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const controller = new AbortController();
    const run: RunState = {
      id: runId,
      parentNodeId: options?.parentNodeId ?? null,
      controller,
      kind: options?.kind ?? "general",
    };
    setRuns((prev) => {
      const next = new Map(prev);
      next.set(runId, run);
      return next;
    });

    const requestState = override?.state ?? stateRef.current;
    const requestFocusedNodeId =
      override?.focusedNodeId ?? focusedNodeId ?? requestState.focusedNodeId;

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          state: requestState,
          focusedNodeId: requestFocusedNodeId,
          userMessage,
          allowWebSearch,
        }),
      });
      const body = await readAgentResponseBody(response);

      if (!response.ok || !body.ok) {
        const detail = Array.isArray(body.issues) && body.issues.length > 0
          ? body.issues
              .map((issue: { path?: string; message?: string }) =>
                [issue.path, issue.message].filter(Boolean).join(": "),
              )
              .join("; ")
          : null;
        throw new Error(
          [body.message ?? body.error ?? "AI 暂时不可用。", detail]
            .filter(Boolean)
            .join(" — "),
        );
      }

      const agentResponse = BrainstormAgentResponseSchema.parse(body.response);
      const latestState = stateRef.current;
      const result = applyAgentResponseToIdeaTree(latestState, agentResponse);
      const nextState = ideaTreeReducer(result.state, {
        type: "record_agent_run",
        userMessage,
        agentMessage: agentResponse.message,
        operationTypes: agentResponse.operations.map((operation) => operation.type),
        appliedOperationTypes: result.appliedOperations,
        ignoredOperationTypes: result.ignoredOperations,
      });

      dispatch({ type: "replace_state", state: nextState });
      stateRef.current = nextState;
      setFocusedNodeId(null);

      if (nextState.clearVersions.length > latestState.clearVersions.length) {
        setClearOpen(true);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "AI 暂时不可用。";
      toast.error(message);
    } finally {
      setRuns((prev) => {
        if (!prev.has(runId)) return prev;
        const next = new Map(prev);
        next.delete(runId);
        return next;
      });
    }
  }

  function handleEnterGrowMode(nodeId: string) {
    setGrowFromNodeId(nodeId);
    setFocusedNodeId(null);
  }

  function handleFavorite(nodeId: string) {
    dispatch({ type: "favorite_node", nodeId });
    setFocusedNodeId(null);
  }

  function handleUnfavorite(nodeId: string) {
    dispatch({ type: "unfavorite_node", nodeId });
    if (focusedNodeId === nodeId) setFocusedNodeId(null);
  }

  function handlePark(nodeId: string) {
    dispatch({ type: "park_node", nodeId });
    setFocusedNodeId(null);
    if (growFromNodeId === nodeId) {
      setGrowFromNodeId(null);
    }
  }

  function handleRestore(nodeId: string) {
    dispatch({ type: "restore_node", nodeId });
    setFocusedNodeId(null);
  }

  function handleMoveNode(nodeId: string, x: number, y: number) {
    dispatch({ type: "move_node", nodeId, x, y });
  }

  function handleBackgroundPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, a, [data-no-pan]")) return;
    panDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleBackgroundPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    drag.moved = true;
    setPan({ x: drag.originX + dx, y: drag.originY + dy });
  }

  function handleBackgroundPointerEnd(event: ReactPointerEvent<HTMLElement>) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    panDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function handleResetWorkspace() {
    if (anyRunning) return;
    if (Object.keys(state.nodes).length > 0) {
      const confirmed = await confirm({
        title: "清空整棵想法树？",
        description: "所有节点、收藏和清晰版本都会被删除，无法恢复。",
        confirmLabel: "清空",
        cancelLabel: "再想想",
        tone: "danger",
      });
      if (!confirmed) return;
    }
    for (const run of runsRef.current.values()) {
      run.controller.abort();
    }
    setRuns(new Map());
    const treeId = state.treeId;
    const fresh = createEmptyIdeaTreeState(treeId);
    dispatch({ type: "replace_state", state: fresh });
    stateRef.current = fresh;
    setFocusedNodeId(null);
    setGrowFromNodeId(null);
    setMessage("");
    setClearOpen(false);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    try {
      await clearIdeaTreeState(getBrowserDb(dbRef), treeId);
      // Re-create empty tree row so this canvas stays in the list.
      await createStoredTree(getBrowserDb(dbRef), treeId);
      await refreshTrees();
    } catch {
      toast.error("清空本地存储失败，请刷新页面再试。");
    }
  }

  async function switchToCanvas(nextTreeId: string) {
    if (nextTreeId === state.treeId) return;
    for (const run of runsRef.current.values()) {
      run.controller.abort();
    }
    setRuns(new Map());
    const db = getBrowserDb(dbRef);
    const loaded = await loadIdeaTreeState(db, nextTreeId);
    const nextState = loaded ?? createEmptyIdeaTreeState(nextTreeId);
    dispatch({ type: "replace_state", state: nextState });
    stateRef.current = nextState;
    setActiveTreeId(nextTreeId);
    persistActiveTreeId(nextTreeId);
    setFocusedNodeId(null);
    setGrowFromNodeId(null);
    setMessage("");
    setClearOpen(false);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    await refreshTrees();
  }

  async function handleCreateCanvas() {
    if (anyRunning) return;
    const newId = generateTreeId();
    const db = getBrowserDb(dbRef);
    await createStoredTree(db, newId);
    for (const run of runsRef.current.values()) {
      run.controller.abort();
    }
    setRuns(new Map());
    const fresh = createEmptyIdeaTreeState(newId);
    dispatch({ type: "replace_state", state: fresh });
    stateRef.current = fresh;
    setActiveTreeId(newId);
    persistActiveTreeId(newId);
    setFocusedNodeId(null);
    setGrowFromNodeId(null);
    setMessage("");
    setClearOpen(false);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    await refreshTrees();
  }

  async function handleSwitchCanvas(treeId: string) {
    if (anyRunning) {
      toast("等当前的发散完成，再切换画布会更稳。");
      return;
    }
    await switchToCanvas(treeId);
  }

  async function handleDeleteCanvas(treeId: string) {
    if (anyRunning) {
      toast("等当前的发散完成，再删除画布。");
      return;
    }
    const summary = trees.find((tree) => tree.treeId === treeId);
    const titleLabel = summary && summary.title.trim().length > 0
      ? `「${summary.title}」`
      : "这个画布";
    const confirmed = await confirm({
      title: `删除画布${titleLabel}？`,
      description: "所有节点、收藏和清晰版本都会消失，无法恢复。",
      confirmLabel: "删除",
      cancelLabel: "再想想",
      tone: "danger",
    });
    if (!confirmed) return;

    const db = getBrowserDb(dbRef);
    await clearIdeaTreeState(db, treeId);

    if (treeId === state.treeId) {
      const remaining = await listStoredTrees(db);
      if (remaining.length > 0) {
        await switchToCanvas(remaining[0].treeId);
      } else {
        const newId = generateTreeId();
        await createStoredTree(db, newId);
        const fresh = createEmptyIdeaTreeState(newId);
        dispatch({ type: "replace_state", state: fresh });
        stateRef.current = fresh;
        setActiveTreeId(newId);
        persistActiveTreeId(newId);
        setFocusedNodeId(null);
        setGrowFromNodeId(null);
        setMessage("");
        setClearOpen(false);
        setPan({ x: 0, y: 0 });
        setZoom(1);
        await refreshTrees();
      }
    } else {
      await refreshTrees();
    }
  }

  async function handleRenameCanvas(treeId: string, title: string) {
    const db = getBrowserDb(dbRef);
    if (treeId === state.treeId) {
      dispatch({ type: "rename_tree", title });
    }
    await renameStoredTree(db, treeId, title);
    await refreshTrees();
  }

  function handleSendMessage() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setMessage("");

    if (!rootSeeded) {
      const seededState = ideaTreeReducer(state, { type: "seed_root", title: trimmed });
      dispatch({ type: "replace_state", state: seededState });
      stateRef.current = seededState;
      setFocusedNodeId(null);
      void runAgent(
        `用户刚刚把模糊想法说成了「${trimmed}」。请围绕这个想法长出 3-4 个不同但相关的子方向，作为继续 brainstorm 的起点。`,
        false,
        { state: seededState, focusedNodeId: seededState.rootNodeId },
        { parentNodeId: seededState.rootNodeId, kind: "grow" },
      );
      return;
    }

    if (growFromNode) {
      if (busyParentIds.has(growFromNode.id)) {
        toast("这个节点正在长出新方向，等它完成再继续。");
        setMessage(trimmed);
        return;
      }
      const targetId = growFromNode.id;
      const targetTitle = growFromNode.title;
      setGrowFromNodeId(null);
      void runAgent(
        `围绕「${targetTitle}」按这个角度续写：${trimmed}`,
        shouldAllowWebSearch(trimmed),
        { state, focusedNodeId: targetId },
        { parentNodeId: targetId, kind: "grow" },
      );
      return;
    }

    void runAgent(trimmed, shouldAllowWebSearch(trimmed));
  }

  function handleFocusedQuickAction(actionId: BrainstormQuickActionId) {
    const target = growFromNode ?? focusedNode;
    if (!target) return;
    if (busyParentIds.has(target.id)) {
      toast("这个节点正在长出新方向，等它完成再继续。");
      return;
    }
    const preGenerated = target.quickActionPrompts?.[
      actionId as keyof NonNullable<typeof target.quickActionPrompts>
    ];
    let userMessage: string;
    let allowWebSearch: boolean;
    if (preGenerated) {
      userMessage = preGenerated;
      allowWebSearch = actionId === "find_similar_cases";
    } else {
      const request = buildBrainstormQuickActionRequest(actionId, {
        focusedNodeTitle: target.title,
        parkedNodeCount: parkedNodes.length,
      });
      userMessage = request.userMessage;
      allowWebSearch = request.allowWebSearch;
    }
    setGrowFromNodeId(null);
    void runAgent(
      userMessage,
      allowWebSearch,
      { state, focusedNodeId: target.id },
      { parentNodeId: target.id, kind: "grow" },
    );
  }

  return (
    <main
      className="grid h-screen grid-cols-1 overflow-hidden"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <section
        ref={sectionRef as MutableRefObject<HTMLElement | null>}
        className="relative overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        aria-label="Idea Tree workspace"
        style={{
          background:
            "radial-gradient(circle, var(--canvas-dot) 1px, transparent 1px), linear-gradient(180deg, var(--canvas), var(--bg))",
          backgroundSize: "26px 26px, auto",
        }}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handleBackgroundPointerMove}
        onPointerUp={handleBackgroundPointerEnd}
        onPointerCancel={handleBackgroundPointerEnd}
      >
        <WorkspaceTopbar
          onReset={() => void handleResetWorkspace()}
          canReset={!anyRunning && Object.keys(state.nodes).length > 0}
          onCreateCanvas={() => void handleCreateCanvas()}
          canCreateCanvas={!anyRunning}
          rootSeeded={rootSeeded}
          canConverge={canConverge}
          convergeLoading={convergeRunning}
          onConverge={() => {
            void runAgent(
              "基于我收藏的方向和已经放一边的取舍，整理一版阶段性的清晰版本。",
              false,
              undefined,
              { kind: "converge" },
            );
          }}
        />

        {rootSeeded ? (
          <IdeaTreeCanvas
            nodes={nodes}
            edges={edges}
            favoritedNodeIds={favoritedNodeIds}
            focusedNode={focusedNode}
            focusedNodeId={focusedNodeId}
            busyParentIds={busyParentIds}
            pendingFanOuts={pendingFanOuts}
            panX={pan.x}
            panY={pan.y}
            zoom={zoom}
            zoomRef={zoomRef}
            onFocusNode={setFocusedNodeId}
            onMoveNode={handleMoveNode}
            onEnterGrowMode={handleEnterGrowMode}
            onFavorite={handleFavorite}
            onUnfavorite={handleUnfavorite}
            onPark={handlePark}
            onRestore={handleRestore}
            onCloseFocused={() => setFocusedNodeId(null)}
          />
        ) : (
          <EmptyCanvasHint loading={anyRunning} />
        )}

        <LeftDock
          aboutOpen={aboutOpen}
          onToggleAbout={() => setAboutOpen((value) => !value)}
          canvasOpen={canvasOpen}
          onToggleCanvas={() => setCanvasOpen((value) => !value)}
          favoritedNodes={favoritedNodes}
          onUnfavorite={handleUnfavorite}
        />

        <ZoomControls
          zoom={zoom}
          onZoomIn={() => applyZoom(zoomRef.current * ZOOM_STEP)}
          onZoomOut={() => applyZoom(zoomRef.current / ZOOM_STEP)}
          onReset={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            zoomRef.current = 1;
            panRef.current = { x: 0, y: 0 };
          }}
        />

        <BottomChat
          rootSeeded={rootSeeded}
          message={message}
          onChangeMessage={setMessage}
          onSend={handleSendMessage}
          growFromNode={growFromNode}
          growFromNodeBusy={
            growFromNode ? busyParentIds.has(growFromNode.id) : false
          }
          onClearGrowFrom={() => setGrowFromNodeId(null)}
          onQuickAction={handleFocusedQuickAction}
        />

        <AboutYouPanel open={aboutOpen} onClose={() => setAboutOpen(false)} />

        {canvasOpen && (
          <CanvasManagerPanel
            onClose={() => setCanvasOpen(false)}
            trees={trees}
            activeTreeId={state.treeId}
            onSwitch={(treeId) => {
              void handleSwitchCanvas(treeId).then(() => setCanvasOpen(false));
            }}
            onCreate={() => {
              void handleCreateCanvas().then(() => setCanvasOpen(false));
            }}
            onRename={(treeId, title) => {
              void handleRenameCanvas(treeId, title);
            }}
            onDelete={(treeId) => {
              void handleDeleteCanvas(treeId);
            }}
          />
        )}
      </section>

      {clearOpen && (
        <ClearVersionModal
          state={state}
          favoritedNodes={favoritedNodes}
          parkedNodes={parkedNodes}
          onClose={() => setClearOpen(false)}
        />
      )}

      {confirmDialog}
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

type AgentResponseBody = {
  ok?: boolean;
  message?: string;
  error?: string;
  issues?: Array<{ path?: string; message?: string }>;
  response?: unknown;
};

async function readAgentResponseBody(response: Response): Promise<AgentResponseBody> {
  const text = await response.text();
  if (!text) {
    return {
      ok: false,
      error: "empty_response",
      message: response.ok ? "服务返回了空响应。" : describeHttpStatus(response.status),
    };
  }
  try {
    return JSON.parse(text) as AgentResponseBody;
  } catch {
    return {
      ok: false,
      error: "non_json_response",
      message: response.ok
        ? "服务返回了非 JSON 响应。"
        : `${describeHttpStatus(response.status)} — ${truncateForToast(text)}`,
    };
  }
}

function describeHttpStatus(status: number): string {
  if (status >= 500) return `AI 服务暂时不可用（HTTP ${status}），稍等再试一次。`;
  if (status === 504) return "AI 思考时间超过上限，再点一次「收敛一下」试试。";
  if (status === 429) return "请求太密了，稍等几秒再试一次。";
  if (status >= 400) return `请求被拒绝（HTTP ${status}）。`;
  return `服务异常（HTTP ${status}）。`;
}

function truncateForToast(value: string, limit = 160): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit)}…`;
}

function EmptyCanvasHint({ loading }: { loading: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center">
          <BrandMark size={48} />
        </div>
        <h2
          className="mt-4 text-[22px] font-medium tracking-[-0.01em]"
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-serif-sc), var(--font-serif), serif",
          }}
        >
          先把那个模糊的想法说出来
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--ink-soft)" }}
        >
          {loading
            ? "正在围绕你说的那句话长出第一批子想法…"
            : "不需要完整，不需要正确。下面输入一句话作为根想法，AI 会从这里开始陪你发散，多条方向可以并行长下去。"}
        </p>
      </div>
    </div>
  );
}

function WorkspaceTopbar({
  onReset,
  canReset,
  onCreateCanvas,
  canCreateCanvas,
  rootSeeded,
  canConverge,
  convergeLoading,
  onConverge,
}: {
  onReset: () => void;
  canReset: boolean;
  onCreateCanvas: () => void;
  canCreateCanvas: boolean;
  rootSeeded: boolean;
  canConverge: boolean;
  convergeLoading: boolean;
  onConverge: () => void;
}) {
  return (
    <div className="absolute left-6 right-6 top-5 z-10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <BrandMark size={28} />
        <span
          className="text-[22px] leading-none"
          style={{
            color: "var(--green-700)",
            fontFamily: "var(--font-serif-sc), var(--font-serif), serif",
            letterSpacing: "-0.01em",
          }}
        >
          引绪
        </span>
      </div>
      <div className="flex items-center gap-2">
        {rootSeeded && (
          <ConvergeBadge
            canConverge={canConverge}
            loading={convergeLoading}
            onConverge={onConverge}
          />
        )}
        <TopbarIconButton
          icon={<FilePlus size={15} strokeWidth={1.75} aria-hidden />}
          onClick={onCreateCanvas}
          disabled={!canCreateCanvas}
          ariaLabel="新建画布"
          title="新建一块空白画布"
        />
        <TopbarIconButton
          icon={<RotateCcw size={15} strokeWidth={1.75} aria-hidden />}
          onClick={onReset}
          disabled={!canReset}
          ariaLabel="清空画布"
          title="清空当前想法树，回到空白入口"
        />
      </div>
    </div>
  );
}

function TopbarIconButton({
  icon,
  onClick,
  disabled,
  ariaLabel,
  title,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-no-pan=""
      className="grid h-8 w-8 place-items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: "var(--paper)",
        borderColor: "var(--paper-edge)",
        color: "var(--ink-soft)",
        boxShadow: "var(--shadow-sm)",
      }}
      aria-label={ariaLabel}
      title={title}
    >
      {icon}
    </button>
  );
}

function ConvergeBadge({
  canConverge,
  loading,
  onConverge,
}: {
  canConverge: boolean;
  loading: boolean;
  onConverge: () => void;
}) {
  const active = canConverge || loading;
  return (
    <button
      type="button"
      onClick={canConverge && !loading ? onConverge : undefined}
      disabled={!canConverge || loading}
      data-no-pan=""
      aria-label={
        loading
          ? "正在整理一版清晰版本"
          : canConverge
            ? "收敛当前想法"
            : "想法还在发散，再多长几层就能收敛"
      }
      aria-busy={loading}
      title={
        loading
          ? "正在收敛，通常 10–20 秒"
          : canConverge
            ? "基于现在的收藏和取舍，整理一版清晰版本"
            : "等想法长到四五层之后，这里会亮起来"
      }
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed"
      style={{
        background: active ? "var(--paper-warm)" : "var(--paper)",
        borderColor: active ? "var(--warm-edge)" : "var(--paper-edge)",
        color: active ? "var(--warm)" : "var(--ink-mute)",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        opacity: loading ? 0.85 : canConverge ? 1 : 0.7,
      }}
    >
      {loading ? (
        <Loader2 size={14} strokeWidth={1.75} className="animate-spin" aria-hidden />
      ) : (
        <Telescope size={14} strokeWidth={1.75} aria-hidden />
      )}
      <span>
        {loading ? "正在收敛…" : canConverge ? "收敛一下" : "继续长一会儿"}
      </span>
    </button>
  );
}

function LeftDock({
  aboutOpen,
  onToggleAbout,
  canvasOpen,
  onToggleCanvas,
  favoritedNodes,
  onUnfavorite,
}: {
  aboutOpen: boolean;
  onToggleAbout: () => void;
  canvasOpen: boolean;
  onToggleCanvas: () => void;
  favoritedNodes: IdeaNode[];
  onUnfavorite: (nodeId: string) => void;
}) {
  return (
    <div className="absolute left-4 top-1/2 z-20 -translate-y-1/2">
      <div
        className="flex flex-col items-center gap-1 rounded-3xl border p-1.5"
        style={{
          background: "var(--paper)",
          borderColor: "var(--paper-edge)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <button
          type="button"
          data-about-trigger=""
          aria-pressed={aboutOpen}
          aria-label="关于你"
          onClick={onToggleAbout}
          className="grid h-10 w-10 place-items-center rounded-2xl transition"
          style={{
            background: aboutOpen ? "var(--paper-warm)" : "transparent",
            color: aboutOpen ? "var(--warm)" : "var(--ink-soft)",
          }}
        >
          <CircleUserRound size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          data-canvas-trigger=""
          aria-pressed={canvasOpen}
          aria-label="历史画布"
          onClick={onToggleCanvas}
          className="relative grid h-10 w-10 place-items-center rounded-2xl transition"
          style={{
            background: canvasOpen ? "var(--paper-warm)" : "transparent",
            color: canvasOpen ? "var(--warm)" : "var(--ink-soft)",
          }}
        >
          <History size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <IdeaBasket
          nodes={favoritedNodes}
          onUnfavorite={onUnfavorite}
        />
      </div>
    </div>
  );
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const percent = Math.round(zoom * 100);
  const canZoomIn = zoom < ZOOM_MAX - 1e-3;
  const canZoomOut = zoom > ZOOM_MIN + 1e-3;
  const canReset = Math.abs(zoom - 1) > 1e-3;
  return (
    <div
      data-no-pan=""
      className="absolute bottom-6 right-6 z-10 flex items-center gap-0.5 rounded-full border p-1"
      style={{
        background: "var(--paper)",
        borderColor: "var(--paper-edge)",
        boxShadow: "var(--shadow-md)",
        color: "var(--ink-soft)",
      }}
    >
      <button
        type="button"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label="缩小"
        title="缩小 (Cmd/Ctrl + 滚轮)"
        className="grid h-8 w-8 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[color:var(--paper-warm)]"
      >
        <Minus size={14} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={!canReset}
        aria-label="还原缩放"
        title="还原到 100%"
        className="min-w-[44px] rounded-full px-2 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[color:var(--paper-warm)]"
        style={{ color: "var(--ink-soft)" }}
      >
        {percent}%
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="放大"
        title="放大 (Cmd/Ctrl + 滚轮)"
        className="grid h-8 w-8 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[color:var(--paper-warm)]"
      >
        <Plus size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}


const FOCUSED_QUICK_ACTION_IDS: BrainstormQuickActionId[] = [
  "shift_angle",
  "find_counterexample",
  "find_similar_cases",
  "synthesize_direction",
];

const FOCUSED_QUICK_ACTIONS = FOCUSED_QUICK_ACTION_IDS.map((id) => {
  const action = BRAINSTORM_QUICK_ACTIONS.find((candidate) => candidate.id === id);
  if (!action) throw new Error(`missing quick action: ${id}`);
  return action;
});

function BottomChat({
  rootSeeded,
  message,
  onChangeMessage,
  onSend,
  growFromNode,
  growFromNodeBusy,
  onClearGrowFrom,
  onQuickAction,
}: {
  rootSeeded: boolean;
  message: string;
  onChangeMessage: (value: string) => void;
  onSend: () => void;
  growFromNode: IdeaNode | null;
  growFromNodeBusy: boolean;
  onClearGrowFrom: () => void;
  onQuickAction: (actionId: BrainstormQuickActionId) => void;
}) {
  const placeholder = !rootSeeded
    ? "把你最初那个还没成型的想法说出来，比如「想做一个让人把模糊想法想清楚的工具」"
    : growFromNode
      ? growFromNodeBusy
        ? `「${growFromNode.title}」正在长出新方向…`
        : `围绕「${growFromNode.title}」按这个角度续写…`
      : "继续问，或换个角度发散一下";

  const canSend = Boolean(message.trim()) && !(growFromNode && growFromNodeBusy);
  const showQuickActions = growFromNode !== null && !growFromNodeBusy;

  return (
    <div className="absolute bottom-6 left-1/2 z-10 w-[min(720px,calc(100%-48px))] -translate-x-1/2 space-y-2">
      {showQuickActions ? (
        <div
          className="flex flex-wrap items-center gap-1.5 px-1"
          aria-label={`「${growFromNode.title}」的快捷发散`}
        >
          {FOCUSED_QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onQuickAction(action.id)}
              title={action.description}
              className="rounded-full border px-3 py-1 text-[11.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                background: "var(--paper)",
                borderColor: "var(--paper-edge)",
                color: "var(--ink-soft)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {growFromNode ? (
        <div
          className="flex flex-wrap items-center gap-2 px-1 text-[11.5px]"
          style={{ color: "var(--ink-mute)" }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
            style={{
              background: "var(--paper-warm)",
              borderColor: "var(--warm-edge)",
              color: "var(--warm)",
            }}
          >
            <span>↳ 继续长：{growFromNode.title}</span>
            <button
              type="button"
              onClick={onClearGrowFrom}
              aria-label="取消继续长"
              className="grid h-4 w-4 place-items-center rounded-full text-[10px] leading-none"
              style={{ color: "var(--warm)" }}
            >
              ×
            </button>
          </span>
        </div>
      ) : null}
      <div
        className="flex items-center gap-2 rounded-full border px-4 py-2"
        style={{
          background: "var(--paper)",
          borderColor: growFromNode ? "var(--warm-edge)" : "var(--paper-edge)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <input
          value={message}
          onChange={(event) => onChangeMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSend();
          }}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
          style={{ color: "var(--ink)" }}
          placeholder={placeholder}
          aria-label="问 AI"
          suppressHydrationWarning
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="grid h-9 w-9 place-items-center rounded-full text-white disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: "var(--green-500)" }}
          aria-label="发送"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
