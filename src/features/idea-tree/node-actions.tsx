import { toast } from "sonner";

import type { IdeaNode } from "./idea-tree-reducer";

export function NodeActions({
  node,
  favorited,
  onEnterGrowMode,
  onFavorite,
  onUnfavorite,
  onPark,
  onRestore,
  onClose,
  growDisabled = false,
}: {
  node: IdeaNode;
  favorited: boolean;
  onEnterGrowMode: () => void;
  onFavorite: () => void;
  onUnfavorite: () => void;
  onPark: () => void;
  onRestore: () => void;
  onClose: () => void;
  growDisabled?: boolean;
}) {
  const isParked = node.status === "parked";
  const isRoot = node.parentId === null;

  async function handleCopy() {
    const text = node.description
      ? `${node.title}\n\n${node.description}`
      : node.title;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选中复制");
    }
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border px-1.5 py-1"
      style={{
        background: "var(--paper-warm)",
        borderColor: "var(--warm-edge)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <button
        type="button"
        onClick={onEnterGrowMode}
        disabled={growDisabled || isParked}
        className="rounded-full px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-45"
        style={{ background: "var(--green-50)", color: "var(--green-600)" }}
      >
        继续长
      </button>
      <button
        type="button"
        onClick={favorited ? onUnfavorite : onFavorite}
        className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
        style={{
          background: favorited ? "var(--warm)" : "var(--green-500)",
        }}
      >
        {favorited ? "取消收藏" : "收藏"}
      </button>
      {!isRoot && (
        <button
          type="button"
          onClick={isParked ? onRestore : onPark}
          className="rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: "var(--warm-soft)", color: "var(--warm)" }}
        >
          {isParked ? "恢复" : "放一边"}
        </button>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ background: "var(--paper)", color: "var(--ink-soft)" }}
      >
        复制
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭节点追问"
        className="ml-0.5 grid h-6 w-6 place-items-center rounded-full transition"
        style={{ color: "var(--ink-mute)" }}
      >
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
        </svg>
      </button>
    </div>
  );
}
