import { useState } from "react";
import { ShoppingBasket } from "lucide-react";

import type { IdeaNode } from "./idea-tree-reducer";

export function IdeaBasket({
  nodes,
  onUnfavorite,
}: {
  nodes: IdeaNode[];
  onUnfavorite: (nodeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasNodes = nodes.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="想法篮子"
        className="relative grid h-10 w-10 place-items-center rounded-2xl transition"
        style={{
          background: open ? "var(--paper-warm)" : "transparent",
          color: open ? "var(--warm)" : "var(--ink-soft)",
        }}
      >
        <ShoppingBasket size={18} strokeWidth={1.75} aria-hidden />
        {hasNodes && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-[16px] min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-semibold leading-none text-white"
            style={{
              background: "var(--warm)",
              boxShadow: "0 0 0 2px var(--paper)",
            }}
            aria-hidden
          >
            {nodes.length}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute left-14 top-1/2 w-72 -translate-y-1/2 rounded-2xl border p-4"
          style={{
            background: "var(--paper)",
            borderColor: "var(--warm-edge)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--warm)" }}
              >
                想法篮子
              </div>
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--ink-mute)" }}>
                你收藏的方向；清晰版本会从这些汇总。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-base leading-none"
              style={{ color: "var(--ink-mute)" }}
              aria-label="关闭"
            >
              ×
            </button>
          </div>
          {hasNodes ? (
            <>
              <div className="space-y-2">
                {nodes.map((node) => {
                  return (
                    <div
                      key={node.id}
                      className="rounded-xl border px-3 py-2.5"
                      style={{
                        background: "var(--paper-warm)",
                        borderColor: "var(--warm-edge)",
                      }}
                    >
                      <div
                        className="text-[13px] font-semibold leading-snug"
                        style={{ color: "var(--ink)" }}
                      >
                        {node.title}
                      </div>
                      {node.description && (
                        <div
                          className="mt-1 text-[11px] leading-relaxed"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          {node.description}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => onUnfavorite(node.id)}
                        className="mt-2 text-[11px] font-medium"
                        style={{ color: "var(--warm)" }}
                      >
                        取消收藏
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div
              className="rounded-xl border border-dashed px-3 py-6 text-center text-[12px] leading-relaxed"
              style={{
                borderColor: "var(--warm-edge)",
                color: "var(--ink-mute)",
              }}
            >
              篮子还是空的。<br />
              去树上点一下喜欢的方向，<br />
              收藏到这里慢慢汇总。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
