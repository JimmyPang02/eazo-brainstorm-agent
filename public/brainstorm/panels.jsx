// panels.jsx — Drawer (basket), AboutYou, ConvergePrompt, SynthesisModal, BasketTab

const { useState, useEffect } = React;

/* ─── BASKET TAB ─────────────────────────────────────── */
function BasketTab({ count, onOpen }) {
  return (
    <div className="basket-tab" onClick={onOpen} title="想法篮子">
      <div className="count">{count}</div>
      <div className="label">想法篮子</div>
    </div>
  );
}

/* ─── DRAWER ─────────────────────────────────────────── */
function Drawer({ open, items, onClose, onRestore }) {
  return (
    <div className={'drawer ' + (open ? 'open' : '')}>
      <div className="drawer-head">
        <button className="close-x" onClick={onClose}>×</button>
        <div className="drawer-title">想法篮子</div>
        <div className="drawer-sub">这里是你"修剪掉"或没选中的分支。它们没有消失——点 Restore 拖回到树上。</div>
      </div>
      <div className="drawer-list">
        {items.length === 0 && (
          <div className="basket-empty">
            还没有被搁置的想法<br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>长按任意节点可以把它放进来</span>
          </div>
        )}
        {items.map(n => (
          <div key={n.id} className="basket-item">
            <button className="restore" onClick={() => onRestore(n)}>↩ RESTORE</button>
            <div className="from-layer">第 {n.layer} 层 · 来源 {n.from === 'user' ? '你' : 'AI'}</div>
            <div className="ttl">{n.title}</div>
            <div className="ds">{n.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ABOUT YOU PANEL ────────────────────────────────── */
function AboutYou({ onClose }) {
  return (
    <div className="about-panel">
      <div className="head">
        <div>
          <h3>关于你</h3>
          <div className="sub">Memory · last updated 3 hours ago</div>
        </div>
        <button className="close-x" onClick={onClose}>×</button>
      </div>
      <div className="body">
        <div className="row">
          <div className="label">视觉偏好</div>
          <div className="value">
            <span className="tag">温暖</span>
            <span className="tag">低饱和</span>
            <span className="tag">自然意象</span>
            <span className="tag">不喜冷峻几何</span>
          </div>
        </div>
        <div className="row">
          <div className="label">语气偏好</div>
          <div className="value">朋友式陪伴 · 避免说教 · 允许"暂停"和"再想想"</div>
        </div>
        <div className="row">
          <div className="label">过去做过的产品</div>
          <div className="value" style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
            情绪日记 (2024 · 拟人化交互)<br />
            校园同好匹配 (2023 · 轻社交)
          </div>
        </div>
        <div className="row">
          <div className="label">最近一周关注</div>
          <div className="value">
            <span className="tag">ADHD</span>
            <span className="tag">学习陪伴</span>
            <span className="tag">拟人化交互</span>
          </div>
        </div>
        <div className="row">
          <div className="label">我会记住的</div>
          <div className="value" style={{ fontSize: 12.5 }}>
            你选择的每一条分支、被你修剪的方向、追问的角度——下次开一个新主题时，我会从这些偏好出发。
          </div>
        </div>
      </div>
      <div className="foot">
        ✦ 节点上有此徽章 = 这个想法和你过去的偏好高度相关
      </div>
    </div>
  );
}

/* ─── CONVERGE PROMPT ────────────────────────────────── */
function ConvergePrompt({ ideaCount, depth, onConverge, onDismiss }) {
  return (
    <div className="converge-prompt fixed-corner">
      <div className="head">
        <span>✦</span>
        <span>AI 提议 · 收敛时机</span>
      </div>
      <div className="body">
        你已经发散了 <strong style={{ color: 'var(--green-700)' }}>{depth} 层、{ideaCount} 个想法</strong>。要不要在这里收一下，把脉络整理成一份可执行的方向？
      </div>
      <div className="actions">
        <button onClick={onDismiss}>再发散一会儿</button>
        <button className="primary" onClick={onConverge}>整理成方案 →</button>
      </div>
    </div>
  );
}

/* ─── SYNTHESIS MODAL ────────────────────────────────── */
function SynthesisModal({ path, basket, drift, onClose }) {
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="close-x" onClick={onClose}>×</button>
        <div className="modal-sub">
          <span className="dot-warm">●</span> SYNTHESIS
          <span style={{ opacity: 0.4 }}>·</span>
          {today}
          <span style={{ opacity: 0.4 }}>·</span>
          为 ADHD 学习者
        </div>
        <h2>把这条路径整理成方案</h2>
        <p className="lede">
          基于你今天选择的 {path.length - 1} 个关键决策，结合你过去倾向"温暖、拟人、不评价"的产品风格，我把这条思路整理成下面的方向。
        </p>

        <section>
          <h3>核心路径</h3>
          <div className="path-chain">
            {path.map((p, i) => (
              <React.Fragment key={p.id}>
                <span className="step">{p.title}</span>
                {i < path.length - 1 && <span className="arrow">→</span>}
              </React.Fragment>
            ))}
          </div>
          <p>
            把"专注"做成屏幕里可见的拟人化伙伴，用低强度的陪伴取代监督，让 ADHD 学习者在不被评判的前提下保持在场。视觉与语气都遵循你一贯的"温暖、不冷峻"取向。
          </p>
        </section>

        <section>
          <h3>关键决策</h3>
          <ul>
            <li><strong>用"在场感"代替"监督感"</strong>——不打卡、不进度条、不评分</li>
            <li><strong>视觉表现拟人化</strong>——猫 / 熊 / 植物等可选形象，让用户保留控制权</li>
            <li><strong>失败不惩罚</strong>——泡泡破了就重新吹一个，没有连胜中断的挫败感</li>
            <li><strong>陪伴节奏低强度</strong>——每 5 分钟轻问一句，可关闭进入纯沉浸模式</li>
          </ul>
        </section>

        {drift.length > 0 && (
          <section>
            <h3>暂时搁置 · 但值得记得</h3>
            <div className="parked">
              {drift.slice(0, 6).map(n => (
                <div key={n.id} className="park-card">
                  <div className="park-ttl">{n.title}</div>
                  <div className="park-ds">{n.desc}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3>下一步要追问的问题</h3>
          <ul>
            <li>"拟人形象"是否允许用户上传自定义？以及如何避免变成壁纸化的"装饰品"？</li>
            <li>专注泡泡破裂后，给用户的反馈节奏是怎样的？多久内不重启？</li>
            <li>这套交互在屏幕熄灭 / 通知静音的场景下如何延续？</li>
            <li>是否需要 ADHD 治疗师参与第一轮原型评估？</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { BasketTab, Drawer, AboutYou, ConvergePrompt, SynthesisModal });
