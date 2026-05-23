// nodes.jsx — Node, Connections, ChatBubble

const { useState, useEffect, useRef } = React;

/* ─── PINE TIER BACKGROUND (SVG) ──────────────────────
   Each spine node renders this behind its content:
   narrow peak at top, sloping sides, scalloped bottom — one tier of a pine. */
const PINE_PATH_STANDARD = (() => {
  // Peak at (50, 0); shoulders curve down to (15, 22) and (85, 22);
  // sides slope to (0, 86), (100, 86); 6 scallops dip to y=100.
  let p = 'M 50 0 ';
  p += 'C 35 3, 22 10, 18 22 ';
  p += 'L 6 60 ';
  p += 'L 0 86 ';
  const scallops = 6;
  const w = 100 / scallops;
  for (let i = 0; i < scallops; i++) {
    const xMid = (i + 0.5) * w;
    const x2 = (i + 1) * w;
    p += `Q ${xMid.toFixed(2)} 100, ${x2.toFixed(2)} 86 `;
  }
  p += 'L 94 60 ';
  p += 'C 78 10, 65 3, 50 0 ';
  p += 'Z';
  return p;
})();

// A shallower-peak version for ROOT (the base tier of the tree)
const PINE_PATH_BASE = (() => {
  let p = 'M 50 4 ';
  p += 'C 38 6, 26 14, 18 30 ';
  p += 'L 6 60 ';
  p += 'L 0 86 ';
  const scallops = 7;
  const w = 100 / scallops;
  for (let i = 0; i < scallops; i++) {
    const xMid = (i + 0.5) * w;
    const x2 = (i + 1) * w;
    p += `Q ${xMid.toFixed(2)} 100, ${x2.toFixed(2)} 86 `;
  }
  p += 'L 94 60 ';
  p += 'C 74 14, 62 6, 50 4 ';
  p += 'Z';
  return p;
})();

function PineTier({ variant }) {
  const d = variant === 'base' ? PINE_PATH_BASE : PINE_PATH_STANDARD;
  return (
    <svg className="pine-tier-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* ─── NODE ───────────────────────────────────────────── */
function Node({ node, focused, onClick, onLongPress, onDrag }) {
  const drag = useRef({ down: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0, timer: null });

  const onPointerDown = (e) => {
    if (e.target.closest('[data-no-drag]')) return;
    e.stopPropagation();
    drag.current = {
      down: true, moved: false,
      sx: e.clientX, sy: e.clientY,
      ox: node.x, oy: node.y, timer: null
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (node.id !== 'root') {
      drag.current.timer = setTimeout(() => {
        if (drag.current.down && !drag.current.moved) {
          onLongPress(node);
          drag.current.down = false;
        }
      }, 600);
    }
  };
  const onPointerMove = (e) => {
    if (!drag.current.down) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (!drag.current.moved && Math.hypot(dx, dy) > 5) {
      drag.current.moved = true;
      clearTimeout(drag.current.timer);
    }
    if (drag.current.moved) {
      onDrag(node, drag.current.ox + dx, drag.current.oy + dy);
    }
  };
  const onPointerUp = (e) => {
    clearTimeout(drag.current.timer);
    if (drag.current.down && !drag.current.moved) {
      onClick(node);
    }
    drag.current.down = false;
  };

  const cls = [
    'node',
    node.id === 'root' ? 'root' : node.state,
    node.mirror ? 'mirror' : '',
    node.fresh ? 'fresh' : '',
    focused ? 'focused' : ''
  ].filter(Boolean).join(' ');

  const isSpine = node.id === 'root' || node.state === 'selected' || node.state === 'option';
  const pineVariant = node.id === 'root' ? 'base' : 'standard';

  return (
    <div
      className={cls}
      style={{ left: node.x, top: node.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {isSpine && <PineTier variant={pineVariant} />}
      {node.memBadge && <div className="node-mem">匹配你的偏好</div>}
      {node.id !== 'root' && (
        <div className={'node-source ' + (node.from === 'user' ? 'user' : '')}>
          <span className="tick"></span>
          {node.from === 'user' ? '你提出' : 'AI 生成'} · 第 {node.layer} 层
        </div>
      )}
      {node.id === 'root' && (
        <div className="node-source">
          <span className="tick"></span>
          根题 · 你的出发点
        </div>
      )}
      <div className="node-title">{node.title}</div>
      {node.state !== 'drift' && <div className="node-desc">{node.desc}</div>}
    </div>
  );
}

/* ─── CONNECTIONS ────────────────────────────────────── */
function Connections({ nodes }) {
  if (nodes.length === 0) return null;
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs, 0) - 240;
  const maxX = Math.max(...xs, 0) + 240;
  const minY = Math.min(...ys, 0) - 120;
  const maxY = Math.max(...ys, 0) + 200;
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <svg
      className="edges"
      style={{ left: minX, top: minY, width: maxX - minX, height: maxY - minY }}
    >
      {nodes.filter(n => n.parent).map(n => {
        const p = byId[n.parent];
        if (!p) return null;
        const x1 = p.x - minX;
        const y1 = p.y - minY - 44;        // TOP of parent (tree grows up)
        const x2 = n.x - minX;
        const y2 = n.y - minY + 44;        // BOTTOM of child
        const mid = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
        let cls = 'edge';
        if (n.state === 'drift') cls += ' dim';
        else if ((n.state === 'selected' || p.id === 'root') && p.state !== 'drift') cls += ' spine';
        return <path key={n.id} d={d} className={cls} />;
      })}
    </svg>
  );
}

/* ─── CHAT BUBBLE ────────────────────────────────────── */
const ELABS = {
  root: '这道题有不少切入口：注意力本身、动机系统、环境氛围。我已经发散了 4 个方向——你被"视觉化专注泡泡"吸引了。',
  a: '把抽象的注意力做成屏幕里可见的物体，是给 ADHD 用户最稳的钩子。我又分了 4 条路径，你选择了"朋友式陪伴"。',
  a2: '"在场感"比"监督感"更重要。朋友式陪伴不评价、只在场，能避开你提过的"负反馈敏感"那个雷区。',
  default: '关于这个节点，我可以再帮你深入展开。选个建议追问填到下方对话栏，或者用"直接发散"一键生长 3 个新分支。'
};

const SUGGESTIONS = {
  root: [
    '为什么先选这条？',
    '另外三条还能复活吗？',
    '梳理一下整体的设计原则',
  ],
  a: [
    '泡泡的视觉到底什么样？',
    '会不会让用户更焦虑？',
    '和市面上的专注 App 有何不同？',
  ],
  a2: [
    '"陪伴"和"监督"的边界在哪？',
    '可以让 AI 完全沉默吗？',
    '伴学形象由谁决定？',
  ],
  default: [
    '它和上一层的关系？',
    '怎么落地这个想法？',
    '可能有什么风险？',
  ],
};

function ChatBubble({ node, onClose, onSpawn, onSuggest }) {
  if (!node) return null;

  const elab = ELABS[node.id] || ELABS.default;
  const suggestions = SUGGESTIONS[node.id] || SUGGESTIONS.default;

  // Position bubble to the right of the node; for nodes at the right edge,
  // flip it to the left side.
  const flipLeft = node.x > 200;
  const left = flipLeft ? node.x - 145 - 340 : node.x + 145;
  const top = node.y - 60;

  return (
    <div className={'bubble ' + (flipLeft ? 'flip-left' : '')} data-no-drag style={{ left, top }}>
      <div className="bubble-head">
        <span>聚焦 · <span className="focused">{node.title}</span></span>
        <button className="close-btn" onClick={onClose} title="关闭">×</button>
      </div>
      <div className="bubble-body">{elab}</div>

      <div className="bubble-section">
        <div className="bubble-section-label">
          <span>建议追问</span>
          <span className="hint">点一下，问题会填进下方对话栏</span>
        </div>
        <div className="bubble-suggestions">
          {suggestions.map((q, i) => (
            <button key={i} className="suggest-chip" onClick={() => onSuggest(q, node)}>
              <span className="arrow">↳</span>
              <span>{q}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bubble-section">
        <div className="bubble-section-label">
          <span>直接发散</span>
          <span className="hint">一键长出 3 个新分支</span>
        </div>
        <div className="bubble-actions">
          <button className="quick-act" onClick={() => onSpawn(node, '再发散 3 个变体')} title="基于这条思路延展 3 个相似变体">
            <span className="qa-glyph">⋮⋮⋮</span>
            <span>3 个变体</span>
          </button>
          <button className="quick-act" onClick={() => onSpawn(node, '反向思路')} title="用反向 / 接纳 / 删减的角度长出 3 个相反方向">
            <span className="qa-glyph">⇄</span>
            <span>反向思路</span>
          </button>
          <button className="quick-act" onClick={() => onSpawn(node, '跨维度发散')} title="跨出当前维度（声音 / 时间 / 身体）长出 3 个新枝">
            <span className="qa-glyph">✦</span>
            <span>跨维度</span>
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TreeNode: Node, Connections, ChatBubble });
