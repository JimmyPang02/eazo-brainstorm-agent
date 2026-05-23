// app.jsx — main App, canvas, state, layout

const { useState, useEffect, useRef, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "cozy",
  "anim": "normal",
  "theme": "light",
  "font": "default"
}/*EDITMODE-END*/;

/* ─── DEMO DATA ────────────────────────────────────────
   x = horizontal offset from spine (negative = left, positive = right)
   y = vertical position (top of canvas)
   state: selected | option | drift                                  */

/* Y: smaller = higher on screen. Tree grows UP — root at bottom, fresh leaves at top */
const Y = { l0: 200, l1: 50, l2: -100, l3: -250, l4: -400, l5: -550 };

const INITIAL_NODES = [
  // L0 root (bottom — soil / seed)
  { id: 'root', parent: null, layer: 0, x: 0, y: Y.l0, state: 'selected', from: 'user',
    title: '为 ADHD 学习者设计保持专注的 App',
    desc: '兼顾"任务启动困难、容易走神、负反馈敏感"三类痛点' },

  // L1 — chose 'a'; b/c/d drifted to the RIGHT (layer 1 = odd → right), stacked downward only
  { id: 'a', parent: 'root', layer: 1, x: 0, y: Y.l1, state: 'selected', from: 'ai',
    title: '视觉化专注泡泡', desc: '把"专注"做成屏幕里可见的物体，分心时它会变形' },
  { id: 'b', parent: 'root', layer: 1, x: 360, y: Y.l1 + 0,   state: 'drift', from: 'ai', mirror: false,
    title: '微目标分解', desc: '把任务切成 3 分钟的可吞咽小块' },
  { id: 'c', parent: 'root', layer: 1, x: 360, y: Y.l1 + 120, state: 'drift', from: 'ai', mirror: true,
    title: '触觉伴学', desc: '用低频震动节拍维持注意力' },
  { id: 'd', parent: 'root', layer: 1, x: 360, y: Y.l1 + 240, state: 'drift', from: 'ai', memBadge: true, mirror: false,
    title: '环境化身', desc: '让学习空间像可装饰的小房间' },

  // L2 — chose 'a2'; a1/a3/a4 drifted to the LEFT (layer 2 = even → left), downward only
  { id: 'a2', parent: 'a', layer: 2, x: 0, y: Y.l2, state: 'selected', from: 'ai', memBadge: true,
    title: '朋友式陪伴', desc: '不监视、只在场，像朋友坐在旁边轻声陪你' },
  { id: 'a1', parent: 'a', layer: 2, x: -360, y: Y.l2 + 0,   state: 'drift', from: 'ai', mirror: true,
    title: '分心识别', desc: '通过光标停滞 / 切换次数识别走神' },
  { id: 'a3', parent: 'a', layer: 2, x: -360, y: Y.l2 + 120, state: 'drift', from: 'ai', mirror: false,
    title: '温柔重启', desc: '失败不惩罚，泡泡破了就重新吹一个' },
  { id: 'a4', parent: 'a', layer: 2, x: -360, y: Y.l2 + 240, state: 'drift', from: 'ai', mirror: true,
    title: '物理隔离', desc: '"白盒子"模式，屏蔽所有通知' },

  // L3 — three live "leaves" at the tip, spread wider
  { id: 'a2-1', parent: 'a2', layer: 3, x: -300, y: Y.l3, state: 'option', from: 'ai', memBadge: true, mirror: false,
    title: '拟人小伴学', desc: '可选猫 / 熊 / 植物形象，会随你的呼吸起伏' },
  { id: 'a2-2', parent: 'a2', layer: 3, x: 0,    y: Y.l3, state: 'option', from: 'ai', mirror: true,
    title: '节拍式轻问', desc: '每 5 分钟轻轻问一句"还在这儿吗"' },
  { id: 'a2-3', parent: 'a2', layer: 3, x: 300,  y: Y.l3, state: 'option', from: 'user', mirror: false,
    title: '共看屏幕', desc: 'AI 视野同步你的屏幕，分心时轻提醒' },
];

/* options to spawn when you commit at each L3 node */
const SPAWN_MAP = {
  'a2-1': [
    { title: '形象库可解锁', desc: '随专注时长解锁新的拟人形象，但不会"过期"' },
    { title: '与呼吸数据联动', desc: '形象会随你的呼吸缓慢起伏', memBadge: true },
    { title: '反应你的情绪', desc: '检测到挫败时，形象会先安静地等你' },
    { title: '离线可用', desc: '本地化身，不需要联网，保护学习专注' },
  ],
  'a2-2': [
    { title: 'AI 学习你的节拍', desc: '每周自动调整轻问频率，找到你的最佳节奏' },
    { title: '完全可关闭', desc: '"静默模式"——存在但不打扰' },
    { title: '思考流可视化', desc: '右侧一条柔和的曲线，显示你"在场"程度' },
    { title: '异常长沉默', desc: '超过 12 分钟没有反应时，轻声问"你卡住了吗"' },
  ],
  'a2-3': [
    { title: '透明权限提示', desc: '每次开启都明示并允许"一键暂停"' },
    { title: '仅提取语义', desc: '不存截图，只提取关键词理解你在做什么' },
    { title: '走神回顾', desc: '一天结束 AI 摘要"你今天在哪走神最多"', memBadge: true },
    { title: 'AI 自动总结', desc: '把你今天的笔记自动整理成知识卡片' },
  ],
};

/* ─── HELPERS ─────────────────────────────────────────── */
function findTip(nodes) {
  // Deepest selected node (the active anchor)
  const selected = nodes.filter(n => n.state === 'selected');
  if (selected.length === 0) return nodes.find(n => n.id === 'root');
  return selected.reduce((a, b) => (a.layer >= b.layer ? a : b));
}

function buildPath(nodes) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const tip = findTip(nodes);
  const out = [];
  let cur = tip;
  while (cur) {
    out.unshift(cur);
    cur = cur.parent ? byId[cur.parent] : null;
  }
  return out;
}

/* ─── BRAND MARK ─────────────────────────────────────── */
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 28 28">
      <path className="stem" d="M14 26 V12" />
      <path className="leaf" d="M14 14 C 6 14, 6 6, 14 4 C 22 6, 22 14, 14 14 Z" opacity="0.85" />
      <circle className="dot" cx="14" cy="9" r="1.6" fill="#fff" opacity="0.95" />
      <path className="stem" d="M14 17 C 10 16, 8 14, 8 14" opacity="0.7" />
      <path className="stem" d="M14 20 C 18 19, 20 17, 20 17" opacity="0.7" />
    </svg>
  );
}

/* ─── APP ─────────────────────────────────────────────── */
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [basket, setBasket] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [bubbleId, setBubbleId] = useState(null);
  const [about, setAbout] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [convergeDismissed, setConvergeDismissed] = useState(false);
  const [synth, setSynth] = useState(false);
  const [hintShown, setHintShown] = useState(true);

  /* apply tweaks to root html */
  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = tweaks.theme || 'light';
    r.dataset.density = tweaks.density || 'cozy';
    r.dataset.anim = tweaks.anim || 'normal';
    r.dataset.font = tweaks.font || 'default';
  }, [tweaks]);

  /* hide hint after 6s */
  useEffect(() => {
    const t = setTimeout(() => setHintShown(false), 6500);
    return () => clearTimeout(t);
  }, []);

  /* ─── CANVAS PAN ──────────────────────────────────── */
  const canvasRef = useRef(null);
  const panState = useRef({ down: false });
  const onCanvasDown = (e) => {
    if (e.target !== canvasRef.current) return;
    panState.current = { down: true, sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y, moved: false };
    canvasRef.current.classList.add('panning');
  };
  const onCanvasMove = (e) => {
    if (!panState.current.down) return;
    const dx = e.clientX - panState.current.sx;
    const dy = e.clientY - panState.current.sy;
    if (!panState.current.moved && Math.hypot(dx, dy) > 4) panState.current.moved = true;
    setPan({ x: panState.current.ox + dx, y: panState.current.oy + dy });
  };
  const onCanvasUp = () => {
    if (panState.current.down && !panState.current.moved) {
      setBubbleId(null);
      setAbout(false);
    }
    panState.current.down = false;
    canvasRef.current?.classList.remove('panning');
  };

  /* ─── NODE INTERACTIONS ──────────────────────────── */
  const onNodeClick = (n) => {
    if (n.state === 'drift') {
      restoreInPlace(n);
      return;
    }
    if (n.state === 'option') {
      commitOption(n);
      return;
    }
    // selected or root → toggle bubble
    setBubbleId(prev => (prev === n.id ? null : n.id));
  };

  const onNodeLongPress = (n) => {
    if (n.id === 'root') return;
    // move to basket (with subtree)
    const subtree = collectSubtree(nodes, n.id);
    setBasket(b => [n, ...b]); // add the head only — keeps basket tidy
    setNodes(ns => ns.filter(x => !subtree.has(x.id)));
    setBubbleId(null);
  };

  const onNodeDrag = (n, x, y) => {
    setNodes(ns => ns.map(z => z.id === n.id ? { ...z, x, y } : z));
  };

  const collectSubtree = (ns, rootId) => {
    const set = new Set([rootId]);
    let added = true;
    while (added) {
      added = false;
      for (const n of ns) {
        if (n.parent && set.has(n.parent) && !set.has(n.id)) {
          set.add(n.id); added = true;
        }
      }
    }
    return set;
  };

  const restoreInPlace = (n) => {
    // Swap: this drift node becomes selected at its parent's column;
    // the previously-selected sibling drifts to the parity-determined side.
    setNodes(ns => {
      const sibs = ns.filter(x => x.parent === n.parent);
      const currentSelected = sibs.find(x => x.state === 'selected');
      const driftSide = n.layer % 2 === 1 ? 1 : -1;
      return ns.map(x => {
        if (x.id === n.id) return { ...x, state: 'selected', x: 0, y: yForLayer(n.layer), mirror: false };
        if (currentSelected && x.id === currentSelected.id) {
          return { ...x, state: 'drift', x: 360 * driftSide, y: yForLayer(n.layer) + 0, mirror: driftSide < 0 };
        }
        return x;
      });
    });
  };

  const commitOption = (n) => {
    setNodes(ns => {
      const sibs = ns.filter(x => x.parent === n.parent);
      const others = sibs.filter(x => x.id !== n.id);
      // drift side: alternate by layer parity (L1→right, L2→left, L3→right, ...)
      const driftSide = n.layer % 2 === 1 ? 1 : -1;
      const updated = ns.map(x => {
        if (x.id === n.id) return { ...x, state: 'selected', x: 0, y: yForLayer(n.layer), mirror: false };
        if (others.includes(x)) {
          const idx = others.indexOf(x);
          return { ...x, state: 'drift', x: 360 * driftSide, y: yForLayer(n.layer) + idx * 120, mirror: (driftSide < 0) ^ (idx % 2 === 0) };
        }
        return x;
      });
      // spawn next layer ABOVE (smaller y = higher on screen)
      const spawn = SPAWN_MAP[n.id];
      if (!spawn) return updated;
      const nextY = yForLayer(n.layer + 1);
      const newKids = spawn.map((s, i) => ({
        id: `${n.id}-${i + 1}`,
        parent: n.id,
        layer: n.layer + 1,
        x: (i - (spawn.length - 1) / 2) * 300,
        y: nextY,
        state: 'option',
        from: 'ai',
        title: s.title,
        desc: s.desc,
        memBadge: s.memBadge,
        mirror: i % 2 === 1,
        fresh: true,
      }));
      return [...updated, ...newKids];
    });
    setConvergeDismissed(false);
    // pan canvas DOWN so the new layer (above) comes into view
    setPan(p => ({ ...p, y: p.y + 110 }));
  };

  const yForLayer = (layer) => {
    const map = { 0: Y.l0, 1: Y.l1, 2: Y.l2, 3: Y.l3, 4: Y.l4, 5: Y.l5 };
    return map[layer] ?? (Y.l0 - layer * 150);
  };

  /* ─── BUBBLE: ASK FROM A NODE ──────────────────────── */
  const onBubbleAsk = (node, msg) => {
    // Spawn 3 user-driven children above the node (tree grows up)
    const baseLayer = node.layer + 1;
    const nextY = yForLayer(baseLayer);
    const userIdeas = ideasForPrompt(msg);
    setNodes(ns => {
      const newKids = userIdeas.map((s, i) => ({
        id: `${node.id}-u${Date.now().toString(36)}-${i}`,
        parent: node.id,
        layer: baseLayer,
        x: node.x + (i - 1) * 250,
        y: nextY - Math.abs(i - 1) * 18,
        state: 'option',
        from: 'user',
        title: s.title,
        desc: s.desc,
        mirror: i % 2 === 1,
        fresh: true,
      }));
      return [...ns, ...newKids];
    });
  };

  /* ─── BOTTOM CHAT ──────────────────────────────────── */
  const chatInputRef = useRef(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMode, setChatMode] = useState('diverge'); // 'diverge' | 'converge'
  const tip = useMemo(() => findTip(nodes), [nodes]);

  /* When user clicks a suggested-question chip inside the bubble:
     fill the bottom chat input and focus it. The bubble stays open so
     the user can see context. Send-target is the bubble's node (handled below). */
  const onSuggest = (text, node) => {
    setChatInput(text);
    setTimeout(() => chatInputRef.current?.focus(), 30);
  };

  const onChatSend = () => {
    const msg = chatInput.trim();
    if (!msg) return;
    if (chatMode === 'converge') { setSynth(true); setChatInput(''); return; }
    // If a bubble is open, the input targets THAT node. Otherwise targets the tip.
    const target = bubbleId ? nodes.find(n => n.id === bubbleId) : tip;
    if (target) onBubbleAsk(target, msg);
    setChatInput('');
  };

  /* ─── RESTORE FROM BASKET ─────────────────────────── */
  /* ─── RESTORE FROM BASKET ─────────────────────────── */
  const onBasketRestore = (n) => {
    setBasket(b => b.filter(x => x.id !== n.id));
    setNodes(ns => {
      // restore at the EXACT original position the node had before being basketed.
      // State becomes 'drift' (user can re-promote by clicking).
      return [...ns, { ...n, state: 'drift' }];
    });
    setDrawer(false);
  };

  /* ─── DERIVED ──────────────────────────────────────── */
  const bubbleNode = nodes.find(n => n.id === bubbleId);
  const path = useMemo(() => buildPath(nodes), [nodes]);
  const driftAll = useMemo(() => nodes.filter(n => n.state === 'drift'), [nodes]);
  const tipNode = useMemo(() => findTip(nodes), [nodes]);
  const tipDepth = tipNode ? tipNode.layer : 0;
  const ideaCount = nodes.length - 1;

  // Show converge prompt when we're at L2+ and not dismissed
  const showConverge = !convergeDismissed && tipDepth >= 2 && !synth;

  return (
    <div className="app">
      {/* TOP BAR */}
      <div className="topbar">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">Sprout</span>
          <span className="brand-tag">Brainstorm Tree</span>
        </div>
        <div className="top-actions">
          <button className="pill-btn" onClick={() => { setAbout(a => !a); }}>
            <span className="glyph">✦</span>
            关于你
          </button>
        </div>
      </div>

      {/* CANVAS */}
      <div
        ref={canvasRef}
        className="canvas"
        onPointerDown={onCanvasDown}
        onPointerMove={onCanvasMove}
        onPointerUp={onCanvasUp}
        onPointerCancel={onCanvasUp}
      >
        <div className="canvas-inner" style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))` }}>
          <Connections nodes={nodes} />
          {nodes.map(n => (
            <TreeNode
              key={n.id}
              node={n}
              focused={n.id === bubbleId}
              onClick={onNodeClick}
              onLongPress={onNodeLongPress}
              onDrag={onNodeDrag}
            />
          ))}
          {bubbleNode && (
            <ChatBubble
              node={bubbleNode}
              onClose={() => setBubbleId(null)}
              onSpawn={onBubbleAsk}
              onSuggest={onSuggest}
            />
          )}
        </div>
      </div>

      {/* CONVERGE PROMPT (fixed, bottom-right) — hidden when bubble or about is open */}
      {showConverge && !about && !bubbleId && (
        <ConvergePrompt
          ideaCount={ideaCount}
          depth={tipDepth + 1}
          onDismiss={() => setConvergeDismissed(true)}
          onConverge={() => setSynth(true)}
        />
      )}

      {/* HINT */}
      {hintShown && (
        <div className="hint-overlay">
          <span><kbd>click</kbd> 选择</span>
          <span><kbd>long-press</kbd> 放进篮子</span>
          <span><kbd>drag</kbd> 重组位置</span>
        </div>
      )}

      {/* BASKET TAB / DRAWER */}
      {!drawer && <BasketTab count={basket.length} onOpen={() => setDrawer(true)} />}
      <Drawer
        open={drawer}
        items={basket}
        onClose={() => setDrawer(false)}
        onRestore={onBasketRestore}
      />

      {/* ABOUT YOU */}
      {about && <AboutYou onClose={() => setAbout(false)} />}

      {/* BOTTOM CHAT */}
      <div className={'bottom-bar ' + (bubbleNode ? 'has-focus' : '')}>
        <div className="context-strip">
          {bubbleNode ? (
            <React.Fragment>
              <span className="ctx-tag focused-ctx">↳ 追问关于：{bubbleNode.title}</span>
              <span className="sep">·</span>
              <span>第 {bubbleNode.layer + 1} 层 · 回车发送</span>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <span className="ctx-tag">基于：{tipNode?.title}</span>
              <span className="sep">·</span>
              <span>第 {tipDepth + 1} 层 · 已生成 {ideaCount} 个想法</span>
            </React.Fragment>
          )}
        </div>
        <div className="bottom-chat">
          <div className="mode-toggle">
            <button className={chatMode === 'diverge' ? 'on' : ''} onClick={() => setChatMode('diverge')}>发散</button>
            <button className={chatMode === 'converge' ? 'on' : ''} onClick={() => setChatMode('converge')}>收敛</button>
          </div>
          <input
            ref={chatInputRef}
            placeholder={
              bubbleNode
                ? `向 AI 追问关于"${bubbleNode.title}"...`
                : chatMode === 'diverge'
                  ? '从这里继续延展 · 比如"加入声音维度"'
                  : '把当前路径收成方案...'
            }
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onChatSend(); }}
          />
          <button className="send" onClick={onChatSend} disabled={!chatInput.trim() && chatMode === 'diverge'}>↑</button>
        </div>
      </div>

      {/* SYNTHESIS MODAL */}
      {synth && (
        <SynthesisModal
          path={path}
          basket={basket}
          drift={driftAll}
          onClose={() => setSynth(false)}
        />
      )}

      {/* TWEAKS PANEL */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="外观" />
        <TweakRadio
          label="主题"
          value={tweaks.theme}
          options={[{ value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]}
          onChange={v => setTweak('theme', v)}
        />
        <TweakRadio
          label="字体"
          value={tweaks.font}
          options={[{ value: 'default', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }]}
          onChange={v => setTweak('font', v)}
        />
        <TweakSection label="节点 / 画布" />
        <TweakRadio
          label="节点密度"
          value={tweaks.density}
          options={[{ value: 'dense', label: '紧凑' }, { value: 'cozy', label: '舒适' }, { value: 'airy', label: '宽松' }]}
          onChange={v => setTweak('density', v)}
        />
        <TweakRadio
          label="动效强度"
          value={tweaks.anim}
          options={[{ value: 'off', label: '关闭' }, { value: 'subtle', label: '克制' }, { value: 'normal', label: '正常' }]}
          onChange={v => setTweak('anim', v)}
        />
      </TweaksPanel>
    </div>
  );
}

/* ─── MOCK IDEA GENERATOR ────────────────────────────── */
function ideasForPrompt(msg) {
  const m = msg.toLowerCase();
  const variants = [
    { title: '把"' + truncate(msg, 14) + '"做成可视', desc: '让用户每次行动都能在屏幕上看到反馈' },
    { title: '让 AI 主动提议', desc: '基于上下文，AI 在合适时候出现，不干扰' },
    { title: '让用户拒绝的权利前置', desc: '所有打断都能"先取消再说"' },
  ];
  const reverse = [
    { title: '反向：不解决，先接纳', desc: '不去对抗这个问题，而是让用户感觉"这样也 OK"' },
    { title: '反向：把弱点变特征', desc: '把"分心"做成一个值得被记录的有趣信号' },
    { title: '反向：极简到只剩一件事', desc: '只做最小可用的一件，删掉所有其他功能' },
  ];
  const crossDim = [
    { title: '声音维度', desc: '加入环境音 / 节拍，作为非视觉的陪伴' },
    { title: '时间维度', desc: '随时间累积变化，今天和一周后体验不同' },
    { title: '身体维度', desc: '调用呼吸 / 微动作，让"在场"被身体感知' },
  ];
  if (m.includes('反向')) return reverse;
  if (m.includes('维度') || m.includes('跨')) return crossDim;
  return variants;
}
function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
