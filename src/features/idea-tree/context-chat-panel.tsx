"use client";

import { useState } from "react";

import type { AgentContextCard } from "./apply-agent-operations";
import type { IdeaNode } from "./idea-tree-reducer";

export function ContextChatPanel({
  currentDirection,
  focusedNode,
  parkedNodes,
  actionCount,
  canClear,
  agentMessage,
  agentCards,
  agentError,
  agentLoading,
  onAskAgent,
  onCancelAgent,
  onRetryAgent,
  onGrowFocused,
  onFollowFocused,
  onParkFocused,
  onCreateClearVersion,
}: {
  currentDirection: IdeaNode | null;
  focusedNode: IdeaNode | null;
  parkedNodes: IdeaNode[];
  actionCount: number;
  canClear: boolean;
  agentMessage: string;
  agentCards: AgentContextCard[];
  agentError: string | null;
  agentLoading: boolean;
  onAskAgent: (message: string, allowWebSearch: boolean) => void;
  onCancelAgent: () => void;
  onRetryAgent: (() => void) | null;
  onGrowFocused: () => void;
  onFollowFocused: () => void;
  onParkFocused: () => void;
  onCreateClearVersion: () => void;
}) {
  const [message, setMessage] = useState("");

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || agentLoading) return;
    onAskAgent(trimmed, shouldAllowWebSearch(trimmed));
    setMessage("");
  }

  return (
    <aside className="flex min-h-0 flex-col border-l border-[#3440371f] bg-[#fffdf8]">
      <div className="border-b border-[#3440371a] p-5">
        <h2 className="text-base font-semibold">AI 对话</h2>
        <p className="mt-2 text-xs leading-relaxed text-[#667168]">
          默认理解当前树、当前节点、已放一边的想法和最近判断。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#edf1e7] px-2.5 py-1 text-[11px] text-[#53645a]">
            当前 {currentDirection?.title ?? "未选择"}
          </span>
          <span className="rounded-full bg-[#edf1e7] px-2.5 py-1 text-[11px] text-[#53645a]">
            篮子 {parkedNodes.length}
          </span>
          <span className="rounded-full bg-[#edf1e7] px-2.5 py-1 text-[11px] text-[#53645a]">
            动作 {actionCount}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
        <div className="rounded-2xl bg-[#f5f2ea] p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b948c]">
            AI
          </span>
          <p className="mt-2 text-sm leading-relaxed text-[#38443c]">
            {agentLoading ? "我正在看当前树上下文..." : agentMessage}
          </p>
        </div>

        {agentError && (
          <div className="rounded-2xl border border-[#b6724238] bg-[#fff7ee] p-4 text-sm leading-relaxed text-[#7a4525]">
            <p>{agentError}</p>
            {onRetryAgent && (
              <button
                type="button"
                onClick={onRetryAgent}
                className="mt-3 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#7a4525]"
              >
                重试
              </button>
            )}
          </div>
        )}

        {agentCards.map((card, index) => (
          <AgentCard key={`${card.type}-${index}`} card={card} />
        ))}

        {focusedNode && focusedNode.status !== "parked" && (
          <section className="rounded-2xl border border-[#b6724238] bg-[#fff7ee] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b67242]">
              节点追问
            </div>
            <p className="mt-2 text-sm leading-relaxed">
              现在聚焦在「{focusedNode.title}」。你可以让它继续长，或者沿它继续。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onGrowFocused}
                className="rounded-full bg-white px-3 py-2 text-xs font-medium"
              >
                继续长
              </button>
              <button
                type="button"
                onClick={onFollowFocused}
                className="rounded-full bg-[#355f49] px-3 py-2 text-xs font-medium text-white"
              >
                沿这条继续
              </button>
              <button
                type="button"
                onClick={onParkFocused}
                className="rounded-full bg-white px-3 py-2 text-xs font-medium"
              >
                放一边
              </button>
            </div>
          </section>
        )}

        {parkedNodes.length > 0 && (
          <section className="rounded-2xl border border-[#3440371a] bg-white p-4">
            <h3 className="text-sm font-semibold">已放一边</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#667168]">
              {parkedNodes.map((node) => node.title).join("、")}。之后我不会主动绕回这些方向。
            </p>
          </section>
        )}

        {canClear && (
          <section className="rounded-2xl border border-[#355f4933] bg-[#eef4e8] p-4">
            <h3 className="text-sm font-semibold">可以收一下了</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#53645a]">
              已有当前方向和取舍痕迹，可以生成一版阶段性的清晰版本。
            </p>
            <button
              type="button"
              onClick={onCreateClearVersion}
              className="mt-3 rounded-full bg-[#355f49] px-4 py-2 text-xs font-semibold text-white"
            >
              生成清晰版本
            </button>
          </section>
        )}
      </div>

      <div className="border-t border-[#3440371a] p-4">
        <div className="flex items-center gap-2 rounded-2xl bg-[#f5f2ea] p-2">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSend();
            }}
            className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[#8b948c]"
            placeholder="问当前树一个问题..."
            aria-label="问当前树一个问题"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={agentLoading || !message.trim()}
            className="grid h-8 w-8 place-items-center rounded-full bg-[#355f49] text-white disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="发送"
          >
            {agentLoading ? "…" : "↑"}
          </button>
          {agentLoading && (
            <button
              type="button"
              onClick={onCancelAgent}
              className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#7a4525]"
            >
              取消
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function AgentCard({ card }: { card: AgentContextCard }) {
  if (card.type === "followup") {
    return (
      <section className="rounded-2xl border border-[#b6724238] bg-[#fff7ee] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b67242]">
          节点追问
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#38443c]">{card.question}</p>
      </section>
    );
  }

  if (card.type === "clear_version_draft") {
    return (
      <section className="rounded-2xl border border-[#355f4933] bg-[#eef4e8] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#53645a]">
          清晰版本草稿
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#1d2520]">{card.summary}</p>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-[#53645a]">
          <p>
            <strong>正在沿这条继续：</strong>
            {card.currentDirection}
          </p>
          <p>
            <strong>先放一边：</strong>
            {card.parked.join("、") || "暂时没有"}
          </p>
          <p>
            <strong>还不确定：</strong>
            {card.uncertain}
          </p>
          <p>
            <strong>下一步：</strong>
            {card.nextThought}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#3440371a] bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b948c]">
        改写建议
      </div>
      {card.title && <h3 className="mt-2 text-sm font-semibold text-[#1d2520]">{card.title}</h3>}
      {card.description && (
        <p className="mt-2 text-xs leading-relaxed text-[#53645a]">{card.description}</p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-[#667168]">{card.reason}</p>
    </section>
  );
}

function shouldAllowWebSearch(message: string) {
  return /搜索|调研|案例|资料|趋势|事实|竞品|新闻|市场|论文|benchmark|research/i.test(message);
}
