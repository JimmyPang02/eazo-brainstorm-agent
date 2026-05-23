import { useEffect, useRef } from "react";

export function AboutYouPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      const node = panelRef.current;
      if (!node) return;
      if (node.contains(event.target as Node)) return;
      const trigger = (event.target as HTMLElement | null)?.closest("[data-about-trigger]");
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="关于你"
      className="absolute left-20 top-1/2 z-30 w-[320px] -translate-y-[calc(50%+44px)] overflow-hidden rounded-2xl border"
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
            关于你
          </h3>
          <div
            className="mt-1 text-[10px] uppercase tracking-[0.14em]"
            style={{
              color: "var(--ink-mute)",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            Memory · last updated 3 hours ago
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
      <div className="px-5 py-2">
        <Row label="视觉偏好">
          <Tags items={["温暖", "低饱和", "自然意象", "不喜冷峻几何"]} />
        </Row>
        <Row label="语气偏好">朋友式陪伴 · 避免说教 · 允许「暂停」和「再想想」</Row>
        <Row label="过去做过的产品">
          <div className="space-y-1 text-[12.5px]" style={{ color: "var(--ink-soft)" }}>
            <div>情绪日记 (2024 · 拟人化交互)</div>
            <div>校园同好匹配 (2023 · 轻社交)</div>
          </div>
        </Row>
        <Row label="最近一周关注">
          <Tags items={["ADHD", "学习陪伴", "拟人化交互"]} />
        </Row>
        <Row label="我会记住的">
          <span className="text-[12.5px]">
            你收藏的每一条分支、被你放一边的方向、追问的角度——下次开一个新主题时，我会从这些偏好出发。
          </span>
        </Row>
      </div>
      <div
        className="px-5 py-3 text-[11.5px] leading-relaxed"
        style={{ background: "var(--bg)", color: "var(--ink-mute)" }}
      >
        ✦ 节点上有此徽章 = 这个想法和你过去的偏好高度相关
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="border-b py-3 last:border-b-0"
      style={{ borderColor: "var(--paper-edge)" }}
    >
      <div
        className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em]"
        style={{
          color: "var(--ink-mute)",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {label}
      </div>
      <div className="text-[13px] leading-[1.55]" style={{ color: "var(--ink)" }}>
        {children}
      </div>
    </div>
  );
}

function Tags({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border px-2.5 py-0.5 text-[11px]"
          style={{
            background: "var(--paper-warm)",
            borderColor: "var(--warm-edge)",
            color: "var(--warm)",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
