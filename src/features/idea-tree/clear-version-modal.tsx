"use client";

import { useMemo, useRef, useState } from "react";

import type { IdeaNode, IdeaTreeState } from "./idea-tree-reducer";

const IFRAME_MIN_HEIGHT = 240;
const IFRAME_MAX_HEIGHT = 720;

export function ClearVersionModal({
  state,
  favoritedNodes,
  parkedNodes,
  onClose,
}: {
  state: IdeaTreeState;
  favoritedNodes: IdeaNode[];
  parkedNodes: IdeaNode[];
  onClose: () => void;
}) {
  const latest = state.clearVersions.at(-1);
  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fallbackHtml = useMemo(
    () => buildFallbackHtml(latest, favoritedNodes, parkedNodes),
    [latest, favoritedNodes, parkedNodes],
  );
  const reportHtml = latest?.html?.trim() ? latest.html : fallbackHtml;
  const srcDoc = useMemo(() => wrapReportHtml(reportHtml), [reportHtml]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="清晰版本"
      style={{ background: "rgba(29, 37, 32, 0.42)" }}
      onClick={onClose}
    >
      <div
        className="relative flex w-[min(820px,100%)] flex-col rounded-3xl"
        style={{
          background: "var(--paper)",
          boxShadow: "var(--shadow-lg)",
          maxHeight: "min(86vh, 880px)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 px-7 pb-4 pt-7">
          <div>
            <div
              className="flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-[0.16em]"
              style={{
                color: "var(--ink-mute)",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              <span style={{ color: "var(--warm)" }}>●</span>
              <span>Synthesis</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{today}</span>
            </div>
            <h2
              className="mt-3 text-[26px] font-medium leading-tight"
              style={{
                color: "var(--ink)",
                fontFamily: "var(--font-serif-sc), var(--font-serif), serif",
                letterSpacing: "-0.01em",
              }}
            >
              这一轮想法现在更清楚了
            </h2>
            {latest?.summary && (
              <p
                className="mt-3 text-[14px] leading-[1.65]"
                style={{ color: "var(--ink-soft)" }}
              >
                {latest.summary}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base"
            style={{ color: "var(--ink-mute)" }}
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-hidden px-7 pb-5">
          <ReportFrame srcDoc={srcDoc} />
        </div>

        <footer className="flex justify-end gap-2 px-7 pb-7 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-5 py-2 text-sm font-medium"
            style={{
              background: "var(--green-50)",
              color: "var(--green-600)",
            }}
          >
            继续想
          </button>
        </footer>
      </div>
    </div>
  );
}

function ReportFrame({ srcDoc }: { srcDoc: string }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(IFRAME_MIN_HEIGHT);

  function measure() {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    const next = Math.min(
      Math.max(IFRAME_MIN_HEIGHT, doc.documentElement.scrollHeight + 8),
      IFRAME_MAX_HEIGHT,
    );
    setHeight(next);
  }

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "var(--bg)",
        border: "1px solid var(--paper-edge)",
      }}
    >
      <iframe
        key={srcDoc}
        ref={frameRef}
        title="收敛报告预览"
        srcDoc={srcDoc}
        sandbox="allow-same-origin"
        onLoad={() => {
          measure();
          // Re-measure shortly after to catch late layout (web fonts, images, etc.)
          window.setTimeout(measure, 120);
        }}
        style={{
          width: "100%",
          height: `${height}px`,
          border: "0",
          background: "transparent",
          display: "block",
        }}
      />
    </div>
  );
}

function wrapReportHtml(reportHtml: string): string {
  // Strip any tags the model shouldn't be sending. The sandbox attribute on the
  // iframe blocks scripts even if the prompt is bypassed, but we still scrub the
  // most obvious vectors so they can't render at all.
  const cleaned = reportHtml
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, "")
    .replace(/<\s*object\b[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, "")
    .replace(/<\s*embed\b[^>]*>/gi, "")
    .replace(/<\s*link\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<base target="_blank" />
<style>
  :root {
    color-scheme: light;
    --ink: #1d2520;
    --ink-soft: #3f4a44;
    --ink-mute: #74807a;
    --warm: #b8651f;
    --warm-soft: #f6e5d3;
    --green: #4d6b56;
    --green-soft: #e8efe7;
    --paper: #f7f4ec;
    --paper-edge: #e3ddd0;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC",
      "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  body { padding: 20px 22px; }
  h1, h2, h3, h4 {
    font-family: "Songti SC", "Source Han Serif SC", "Noto Serif SC", serif;
    color: var(--ink);
    letter-spacing: -0.01em;
    margin: 18px 0 10px;
    line-height: 1.3;
  }
  h1 { font-size: 22px; }
  h2 { font-size: 18px; }
  h3 { font-size: 15px; color: var(--ink-soft); }
  p { margin: 0 0 10px; color: var(--ink-soft); }
  ul, ol { margin: 0 0 12px; padding-left: 22px; color: var(--ink-soft); }
  li { margin-bottom: 6px; }
  strong { color: var(--ink); }
  blockquote {
    margin: 12px 0;
    padding: 10px 14px;
    border-left: 3px solid var(--warm);
    background: var(--warm-soft);
    border-radius: 8px;
    color: var(--ink);
  }
  hr {
    border: 0;
    border-top: 1px dashed var(--paper-edge);
    margin: 16px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 14px;
    font-size: 13px;
  }
  th, td {
    border: 1px solid var(--paper-edge);
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  th { background: var(--paper); color: var(--ink); font-weight: 600; }
  code {
    background: var(--paper);
    padding: 1px 6px;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    color: var(--warm);
  }
  a { color: var(--warm); text-decoration: underline; text-underline-offset: 2px; }
  section { margin-bottom: 14px; }
</style>
</head>
<body>${cleaned}</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFallbackHtml(
  latest: IdeaTreeState["clearVersions"][number] | undefined,
  favoritedNodes: IdeaNode[],
  parkedNodes: IdeaNode[],
): string {
  const favoritedTitles = latest?.favoritedTitles?.length
    ? latest.favoritedTitles
    : favoritedNodes.map((node) => node.title);
  const parkedTitles = latest?.parked?.length
    ? latest.parked
    : parkedNodes.map((node) => node.title);

  const summary =
    latest?.summary ??
    "基于你收藏的方向和已经放一边的取舍，把这一轮的脉络整理在这里。";
  const uncertain = latest?.uncertain ?? "还需要继续发散几个可能性。";
  const nextThought = latest?.nextThought ?? "继续长出几个更小的想法。";

  const favoritedBlock = favoritedTitles.length
    ? `<ul>${favoritedTitles.map((title) => `<li>${escapeHtml(title)}</li>`).join("")}</ul>`
    : "<p>还没有收藏任何方向。</p>";

  const parkedBlock = parkedTitles.length
    ? `<section><h3>暂时放一边</h3><ul>${parkedTitles
        .slice(0, 8)
        .map((title) => `<li>${escapeHtml(title)}</li>`)
        .join("")}</ul></section>`
    : "";

  return `<section>
    <p>${escapeHtml(summary)}</p>
  </section>
  <section>
    <h3>我收藏的方向</h3>
    ${favoritedBlock}
  </section>
  ${parkedBlock}
  <section>
    <h3>我还不确定</h3>
    <p>${escapeHtml(uncertain)}</p>
  </section>
  <section>
    <h3>下一步可以怎么想</h3>
    <p>${escapeHtml(nextThought)}</p>
  </section>`;
}
