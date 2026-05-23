import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import type { StoredTreeSummary } from "./idea-tree-storage";

export type CanvasManagerPanelProps = {
  onClose: () => void;
  trees: StoredTreeSummary[];
  activeTreeId: string;
  onSwitch: (treeId: string) => void;
  onCreate: () => void;
  onRename: (treeId: string, title: string) => void;
  onDelete: (treeId: string) => void;
};

export function CanvasManagerPanel({
  onClose,
  trees,
  activeTreeId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: CanvasManagerPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      const node = panelRef.current;
      if (!node) return;
      if (node.contains(event.target as Node)) return;
      const trigger = (event.target as HTMLElement | null)?.closest("[data-canvas-trigger]");
      if (trigger) return;
      onClose();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  function commitRename(treeId: string) {
    const next = renameDraft.trim();
    if (next.length > 0) {
      onRename(treeId, next);
    }
    setRenamingId(null);
    setRenameDraft("");
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="历史画布"
      data-no-pan=""
      className="absolute left-20 top-1/2 z-30 w-[320px] -translate-y-1/2 overflow-hidden rounded-2xl border"
      style={{
        background: "var(--paper)",
        borderColor: "var(--paper-edge)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div
        className="flex items-start justify-between gap-3 border-b px-5 pb-3 pt-4"
        style={{ borderColor: "var(--paper-edge)" }}
      >
        <div>
          <h3
            className="text-[18px] font-medium leading-tight"
            style={{
              color: "var(--green-700)",
              fontFamily: "var(--font-serif-sc), var(--font-serif), serif",
              letterSpacing: "-0.01em",
            }}
          >
            历史画布
          </h3>
          <div
            className="mt-1 text-[10px] uppercase tracking-[0.14em]"
            style={{
              color: "var(--ink-mute)",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            Canvas History · {trees.length}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="text-lg leading-none"
          style={{ color: "var(--ink-mute)" }}
        >
          ×
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-3 py-2">
        {trees.length === 0 ? (
          <div
            className="m-2 rounded-xl border border-dashed px-3 py-6 text-center text-[12px] leading-relaxed"
            style={{ borderColor: "var(--paper-edge)", color: "var(--ink-mute)" }}
          >
            还没有任何画布。<br />
            下面新建一块开始 brainstorm。
          </div>
        ) : (
          <ul className="space-y-1">
            {trees.map((tree) => {
              const isActive = tree.treeId === activeTreeId;
              const isRenaming = renamingId === tree.treeId;
              const displayTitle = tree.title.trim().length > 0 ? tree.title : "未命名画布";

              const metadata = (
                <>
                  {tree.nodeCount === 0
                    ? "空白"
                    : `${tree.maxLayer + 1} 层 · ${tree.nodeCount} 节点`}
                  <span aria-hidden> · </span>
                  {formatRelativeTime(tree.updatedAt)}
                </>
              );

              return (
                <li key={tree.treeId}>
                  <div
                    className="group relative rounded-xl transition"
                    style={{
                      background: isActive ? "var(--paper-warm)" : "transparent",
                      border: "1px solid",
                      borderColor: isActive ? "var(--warm-edge)" : "transparent",
                    }}
                  >
                    {isRenaming ? (
                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <span
                          aria-hidden
                          className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            background: isActive ? "var(--warm)" : "var(--ink-mute)",
                            opacity: isActive ? 1 : 0.45,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <input
                            autoFocus
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onBlur={() => commitRename(tree.treeId)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitRename(tree.treeId);
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                setRenamingId(null);
                                setRenameDraft("");
                              }
                            }}
                            className="w-full rounded-md border bg-transparent px-2 py-1 text-[13px] font-medium outline-none"
                            style={{
                              borderColor: "var(--warm-edge)",
                              color: "var(--ink)",
                            }}
                            aria-label="重命名画布"
                          />
                          <div
                            className="mt-1 text-[10.5px] uppercase tracking-[0.12em]"
                            style={{
                              color: "var(--ink-mute)",
                              fontFamily: "var(--font-mono), monospace",
                            }}
                          >
                            {metadata}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isActive) onSwitch(tree.treeId);
                        }}
                        disabled={isActive}
                        className="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition disabled:cursor-default enabled:hover:bg-[color:var(--paper-edge)]/30"
                        aria-current={isActive ? "true" : undefined}
                        title={isActive ? `${displayTitle}（当前画布）` : `切换到 ${displayTitle}`}
                      >
                        <span
                          aria-hidden
                          className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            background: isActive ? "var(--warm)" : "var(--ink-mute)",
                            opacity: isActive ? 1 : 0.45,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className="truncate text-[13px] font-medium leading-snug"
                            style={{
                              color: isActive ? "var(--ink)" : "var(--ink-soft)",
                            }}
                          >
                            {displayTitle}
                          </div>
                          <div
                            className="mt-1 text-[10.5px] uppercase tracking-[0.12em]"
                            style={{
                              color: "var(--ink-mute)",
                              fontFamily: "var(--font-mono), monospace",
                            }}
                          >
                            {metadata}
                          </div>
                        </div>
                        <span aria-hidden className="w-[60px] shrink-0" />
                      </button>
                    )}
                    <div className="pointer-events-none absolute right-2 top-2 flex shrink-0 items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setRenamingId(tree.treeId);
                          setRenameDraft(
                            tree.title.trim().length > 0 ? tree.title : "",
                          );
                        }}
                        aria-label="重命名"
                        title="重命名"
                        className="grid h-7 w-7 place-items-center rounded-full transition"
                        style={{ color: "var(--ink-mute)", background: "var(--paper)" }}
                      >
                        <Pencil size={13} strokeWidth={1.75} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(tree.treeId);
                        }}
                        aria-label="删除画布"
                        title="删除画布"
                        className="grid h-7 w-7 place-items-center rounded-full transition"
                        style={{ color: "var(--warm)", background: "var(--paper)" }}
                      >
                        <Trash2 size={13} strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div
        className="border-t px-3 py-2"
        style={{ borderColor: "var(--paper-edge)", background: "var(--bg)" }}
      >
        <button
          type="button"
          onClick={onCreate}
          className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium transition"
          style={{
            background: "var(--paper)",
            borderColor: "var(--paper-edge)",
            color: "var(--green-700)",
          }}
        >
          <Plus size={14} strokeWidth={1.75} aria-hidden />
          <span>新建画布</span>
        </button>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "刚刚";
  const diffMs = Date.now() - then;
  if (diffMs < 60 * 1000) return "刚刚";
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  const years = Math.floor(months / 12);
  return `${years} 年前`;
}
