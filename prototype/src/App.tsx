import { useEffect, useReducer, useRef, useState } from 'react';
import { Layers3, ClipboardList, GitBranch, Route as RouteIcon, TriangleAlert, ListFilter, Settings2, Search, ChevronDown, ArrowUpRight, ArrowRight, X, Play, Pause, RotateCcw, Maximize2, Map, Box, Check, Clock3, CircleHelp, Send, Download, ChevronRight, Radio, SlidersHorizontal, Compass, CheckCheck, ArrowLeft, Eye, Ban } from 'lucide-react';
import Campus from './Campus';
import { candidatePlans, clockLabel, initialCoordination, operators, phaseLabels, positionAt, queryObjects, routes, transition, type PlanId, type RouteId, type Coordination, type Action } from './domain';

type Panel = 'overview' | 'route' | 'event' | 'plans' | 'routes' | 'coordination' | 'audit' | 'site';
const navItems = [
  { id: 'overview', title: '态势', icon: Layers3 }, { id: 'plans', title: '计划', icon: ClipboardList },
  { id: 'coordination', title: '协同', icon: GitBranch }, { id: 'routes', title: '航路', icon: RouteIcon },
  { id: 'event', title: '事件', icon: TriangleAlert }, { id: 'audit', title: '审计', icon: ListFilter },
] as const;

function Dot({ color }: { color: string }) { return <span className="dot" style={{ background: color }} />; }
function Eyebrow({ children }: { children: React.ReactNode }) { return <div className="eyebrow">{children}</div>; }

function CoordinationPanel({ state, dispatch, onCompare }: { state: Coordination; dispatch: React.Dispatch<Action>; onCompare: () => void }) {
  const selected = candidatePlans.find(p => p.id === state.selected);
  const steps = ['生成建议', '各方确认', '落实回执', '运行观测'];
  const progress = state.phase === 'completed' ? 4 : state.phase === 'observing' ? 3 : state.phase === 'confirmed' ? 2 : state.phase === 'pending' ? 1 : 0;
  return <>
    <div className={`status-block ${state.phase === 'completed' ? 'success' : ''}`}>
      {state.phase === 'completed' ? <CheckCheck size={26} /> : state.phase === 'rejected' || state.phase === 'stale' ? <TriangleAlert size={26} /> : <GitBranch size={26} />}
      <h2>{phaseLabels[state.phase]}</h2><p>{state.phase === 'completed' ? '该样例事件已归档，可在审计中回看。' : '每一次确认都关联到同一个建议版本。'}</p>
    </div>
    <div className="step-track">{steps.map((name, i) => <div className={i < progress ? 'done' : ''} key={name}><i>{i < progress ? <Check size={11} /> : i + 1}</i><span>{name}</span></div>)}</div>
    <div className="section-head"><h3>{selected?.name ?? '尚未选择方案'}</h3><span className="micro">建议版本 v{state.version}</span></div>
    <div className="operator-list">{operators.map(o => <div className="operator-row" key={o.id}>
      <div className="operator-avatar">{o.name.slice(0, 1)}</div>
      <div><strong>{o.name}</strong><span>{o.task}</span></div>
      <div className="operator-status">{state.acks[o.id] === 'confirmed' ? <span className="teal">已确认</span> : state.acks[o.id] === 'rejected' ? <span className="coral">已退回</span> : <span className="muted">待确认</span>}
        <small>{state.feedback[o.id] ? '已收落实回执' : '落实待反馈'}</small></div>
    </div>)}</div>
    {state.timedOut && <div className="inline-note warning">确认已超时。请人工跟进，未回复不会被视为同意。</div>}
    {state.phase === 'rejected' && <div className="inline-note warning">退回原因：需重新协调任务时窗（样例）。</div>}
    {state.phase === 'stale' && <div className="inline-note warning">基准计划已变更。原建议失效，需重新比较后发起新版本。</div>}
    {['rejected', 'stale', 'draft'].includes(state.phase) && <button className="primary full" onClick={onCompare}>重新比较方案 <ArrowRight size={16} /></button>}
    {state.phase === 'pending' && <button className="quiet full" onClick={() => dispatch({ type: 'WITHDRAW' })}>撤回当前建议</button>}
    <details className="demo-controls">
      <summary>演示控制 <SlidersHorizontal size={14} /></summary>
      <p>用样例回执体验状态变化，操作仅保存在本次页面中。</p>
      {operators.map(o => <div className="simulation-row" key={o.id}><span>{o.name}</span><div>
        <button aria-label={`模拟${o.name}确认`} disabled={state.phase !== 'pending' || state.acks[o.id] !== 'waiting'} onClick={() => dispatch({ type: 'ACK', operator: o.id, version: state.version })}>确认</button>
        <button aria-label={`模拟${o.name}拒绝`} disabled={state.phase !== 'pending' || state.acks[o.id] !== 'waiting'} onClick={() => dispatch({ type: 'REJECT', operator: o.id, version: state.version })}>拒绝</button>
        <button aria-label={`模拟${o.name}落实回执`} disabled={state.phase !== 'confirmed' || state.feedback[o.id]} onClick={() => dispatch({ type: 'FEEDBACK', operator: o.id, version: state.version })}>落实回执</button>
      </div></div>)}
      <div className="simulation-actions"><button disabled={state.phase !== 'pending'} onClick={() => dispatch({ type: 'TIMEOUT' })}>模拟超时</button><button disabled={!['pending', 'confirmed'].includes(state.phase)} onClick={() => dispatch({ type: 'INVALIDATE' })}>模拟计划变更</button></div>
      <button className="quiet full" disabled={state.phase !== 'observing'} onClick={() => dispatch({ type: 'VERIFY' })}>模拟运行观测通过 <Check size={14} /></button>
    </details>
  </>;
}

export default function App() {
  const [panel, setPanel] = useState<Panel>('overview');
  const [selected, setSelected] = useState<RouteId | null>(null);
  const [compare, setCompare] = useState(false);
  const [preview, setPreview] = useState<PlanId | null>(null);
  const [time, setTime] = useState(150);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<'current' | 'preview' | 'replay'>('preview');
  const [ceiling, setCeiling] = useState(120);
  const [topView, setTopView] = useState(false);
  const [resetView, setResetView] = useState(0);
  const [hidden, setHidden] = useState<RouteId[]>([]);
  const [quality, setQuality] = useState<'standard' | 'low'>('standard');
  const [query, setQuery] = useState('');
  const [queryOpen, setQueryOpen] = useState(false);
  const [state, dispatch] = useReducer(transition, undefined, initialCoordination);
  const [toast, setToast] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDialogElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const sideContentRef = useRef<HTMLDivElement>(null);
  const selectedRoute = routes.find(r => r.id === selected) ?? routes[0];
  const selectedPlan = candidatePlans.find(p => p.id === state.selected);
  const previewPlan = candidatePlans.find(p => p.id === preview);
  const results = queryObjects(query);
  const riskClosed = state.phase === 'completed';
  useEffect(() => { sideContentRef.current?.scrollTo({ top: 0 }); }, [panel, compare, selected]);

  const selectRoute = (id: RouteId) => { setSelected(id); setPanel('route'); setCompare(false); setQueryOpen(false); };
  const openEvent = () => { setPanel('event'); setCompare(false); setSelected(null); setQueryOpen(false); setTime(220); setMode('preview'); setPlaying(false); setCeiling(120); setHidden([]); };
  const openCompare = () => { setPanel('event'); setCompare(true); setSelected(null); setQueryOpen(false); setMode('preview'); setPlaying(false); setCeiling(120); setHidden([]); };
  const selectPlan = (id: PlanId) => { dispatch({ type: 'SELECT', plan: id }); setPreview(id); setTime(220); setMode('preview'); };
  const go = (id: Panel) => {
    setQueryOpen(false); setCompare(false); setSelected(null);
    if (id === 'coordination' && ['draft', 'rejected', 'stale'].includes(state.phase)) { openCompare(); return; }
    setPanel(id);
  };
  const reset = () => {
    dispatch({ type: 'RESET' }); setPreview(null); setTime(150); setPlaying(false); setCeiling(120); setSelected(null); setHidden([]); setTopView(false); setResetView(n => n + 1); setPanel('overview'); setCompare(false); setQuery(''); setQueryOpen(false); setMode('preview');
    setToast('演示已重置'); settingsRef.current?.close();
  };
  const exportLog = () => {
    const file = new Blob([JSON.stringify({ type: 'AIRORDER_DEMO_AUDIT', note: '仅演示记录，未连接运行系统', state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = 'airorder-demo-audit.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setTime(t => {
      if (t >= 600) { setPlaying(false); return 600; }
      return Math.min(600, t + 2);
    }), 250);
    return () => window.clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); setQueryOpen(true); }
      if (e.key === 'Escape') { setQueryOpen(false); searchRef.current?.blur(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, []);

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); go('overview'); }} aria-label="空序首页"><Layers3 size={28} strokeWidth={1.3} /><strong>空序</strong><span>AIRORDER</span></a>
      <span className="header-divider" /><span className="app-title">园区运行工作台</span>
      <div className="header-right"><button className="site-picker" onClick={() => go('site')}>示范园区 <ChevronDown size={14} /></button><span className="demo-badge"><i />场景演示</span><span className="connection-label">未接入运行数据</span><span className="header-divider" /><span className="avatar">管</span><span className="admin-label">管理端</span></div>
    </header>

    <nav className="navigation" aria-label="主导航">
      <div className="nav-main">{navItems.map(n => <button key={n.id} aria-label={n.title} className={(compare ? n.id === 'coordination' : panel === n.id || (panel === 'route' && n.id === 'routes')) ? 'active' : ''} onClick={() => go(n.id)} title={n.title}><n.icon size={21} strokeWidth={1.4} /><span>{n.title}</span>{n.id === 'event' && !riskClosed && <i className="nav-notice" />}</button>)}</div>
      <div className="nav-bottom"><button onClick={() => helpRef.current?.showModal()} aria-label="操作说明"><CircleHelp size={20} strokeWidth={1.4} /><span>帮助</span></button><button onClick={() => settingsRef.current?.showModal()} aria-label="设置"><Settings2 size={20} strokeWidth={1.4} /><span>设置</span></button></div>
    </nav>

    <main className={`workspace ${compare ? 'is-comparing' : ''}`}>
      <div className="work-topline"><div><span className="workspace-title">运行态势</span><span className="slash">/</span><span className="muted">通用示范园区</span></div><div className="sample-time"><Clock3 size={13} /><span>{mode === 'preview' ? '未来预演' : mode === 'replay' ? '样例回放' : '样例当前'}</span><strong>{clockLabel(time)}</strong><span className="date">2026.10.04</span></div></div>
      <div className="scene-row">
        <section className="map-space" aria-label="园区三维态势">
          <Campus time={time} ceiling={ceiling} selected={selected} plan={preview} hidden={hidden} topView={topView} resetView={resetView} quality={quality} showRisk={!riskClosed} focusEvent={panel === 'event' || panel === 'coordination'} onSelect={selectRoute} onEvent={openEvent} />
          <div className={`map-intro ${panel === 'event' || panel === 'coordination' ? 'focused' : ''}`}><Eyebrow>{panel === 'event' || panel === 'coordination' ? 'EVENT C-017' : 'AIRSPACE OVERVIEW'}</Eyebrow><h1>{panel === 'event' || panel === 'coordination' ? '东侧进近区' : <>让每一次飞行，<br />各循其序。</>}</h1><div className="map-legend">{routes.map(r => <button key={r.id} className={hidden.includes(r.id) ? 'off' : ''} onClick={() => setHidden(list => list.includes(r.id) ? list.filter(i => i !== r.id) : [...list, r.id])} aria-pressed={!hidden.includes(r.id)} title={`显示或隐藏${r.business}航路`}><Dot color={r.color} />{r.business}</button>)}</div></div>
          <div className="map-tools"><button title="复位视角" aria-label="复位视角" onClick={() => setResetView(n => n + 1)}><Maximize2 size={17} /></button><span /><button className={!topView ? 'active' : ''} title="三维视图" aria-label="三维视图" onClick={() => setTopView(false)}><Box size={18} /></button><button className={topView ? 'active' : ''} title="平面视图" aria-label="平面视图" onClick={() => setTopView(true)}><Map size={18} /></button></div>
          <div className="height-control"><span className="micro">高度范围</span><strong>0–{ceiling} m</strong><div className="height-track"><span>120</span><input aria-label="可见高度上限" type="range" min="20" max="120" step="10" value={ceiling} onChange={e => setCeiling(Number(e.target.value))} /><span>0</span></div>{ceiling < 120 && <button onClick={() => setCeiling(120)}>全部高度</button>}</div>
          {previewPlan && <div className="preview-banner"><Eye size={14} /><span>正在预演：{previewPlan.name}</span><button onClick={() => setPreview(null)}>查看原计划</button></div>}
          <div className="map-bottom"><div className="map-scale"><span /><small>100 m</small><i>局部坐标</i></div><div className="map-hint">{topView ? '拖动平移 · 滚轮缩放' : '拖动旋转 · 右键平移 · 滚轮缩放'}</div><button className="north" onClick={() => { setTopView(false); setResetView(n => n + 1); }} aria-label="恢复北向参考"><Compass size={23} strokeWidth={1} /><span>N</span></button></div>
          {(hidden.length > 0 || ceiling < 120) && <div className="filter-notice"><ListFilter size={12} />已筛选 · {3 - hidden.length} 条航路 · 0–{ceiling} m</div>}
        </section>

        <aside className="side-panel" aria-label="工作详情">
          <div className="side-header"><Eyebrow>{panel === 'overview' ? '运行简报' : panel === 'route' ? '任务详情' : panel === 'event' ? '事件聚焦' : panel === 'plans' ? '计划与预检' : panel === 'routes' ? '航路目录' : panel === 'audit' ? '过程记录' : panel === 'site' ? '园区信息' : '协同进展'}</Eyebrow><span>{panel === 'overview' ? <span className="live-indicator">样例</span> : <button className="icon-button" aria-label="关闭详情" onClick={() => { setPanel('overview'); setCompare(false); setSelected(null); }}><X size={16} /></button>}</span></div>
          {panel === 'coordination' && <div className="coordination-pinned" aria-live="polite">{`建议 v${state.version} / ${phaseLabels[state.phase]}`}</div>}
          <div className="side-content" ref={sideContentRef}>
            {panel === 'overview' && <>
              <h2 className="brief-title">园区有序，<br /><span>关注一个交汇。</span></h2>
              <div className="metric-grid"><div><strong>03<span>条</span></strong><label>示例航路</label></div><div><strong>04<span>处</span></strong><label>起降设施</label></div><div><strong className={riskClosed ? '' : 'coral'}>{riskClosed ? '00' : '01'}<span>项</span></strong><label>待关注事件</label></div></div>
              {!riskClosed ? <button className="event-card" aria-label="查看冲突 C-017" onClick={openEvent}><div className="event-card-top"><span><TriangleAlert size={14} />预计时空接近</span><span className="micro">C-017</span></div><h3>两条航迹，即将交汇</h3><p>D03 配送与 E01 应急任务<br />在东侧进近区出现接近。</p><div className="event-card-bottom"><span>09:44:40 · 样例预警</span><ArrowUpRight size={18} /></div></button> : <div className="event-card resolved"><CheckCheck size={22} /><h3>本例事件已归档</h3><p>协调记录与回执已保存在本次演示中。</p><button className="text-button" onClick={() => go('audit')}>查看记录 <ArrowRight size={14} /></button></div>}
              <div className="section-head"><h3>在图任务</h3><button onClick={() => go('plans')}>全部计划 <ArrowRight size={13} /></button></div>
              <div className="task-list">{routes.map(r => <button key={r.id} onClick={() => selectRoute(r.id)}><span className="task-symbol" style={{ color: r.color }}><RouteIcon size={18} strokeWidth={1.3} /></span><div><strong>{r.id}<span>{r.name}</span></strong><small>{r.operator}</small></div><span className="task-height">{Math.round(positionAt(r, time, preview)[1])} m<ChevronRight size={13} /></span></button>)}</div>
              <div className="note-row"><Radio size={14} /><span>3家示例运营人 · 接口尚未连接</span></div>
            </>}

            {panel === 'event' && <>
              <div className="detail-kicker"><span className="tag coral">{riskClosed ? '样例已归档' : '预设冲突'}</span><span className="micro">C-017</span></div>
              <h2>进近航段预计接近</h2><p className="lead">配送与应急任务同时进入 E01 起降位的进近航段。</p>
              <div className="time-window"><Clock3 size={19} /><div><small>预计发生时刻</small><strong>09:44:40 <span>+03:40</span></strong></div><button aria-label="跳到冲突时刻" title="跳到冲突时刻" onClick={() => { setTime(220); setPlaying(false); }}><ArrowUpRight size={17} /></button></div>
              <div className="pair-routes">{routes.filter(r => r.id !== 'P02').map(r => <button key={r.id} onClick={() => selectRoute(r.id)}><Dot color={r.color} /><strong>{r.id}</strong><span>{r.operator}</span><ChevronRight size={13} /></button>)}</div>
              <dl className="detail-list"><div><dt>空间位置</dt><dd>园区东侧 · E01 进近区</dd></div><div><dt>原计划水平间隔</dt><dd>14 m <span className="coral">低于样例阈值</span></dd></div><div><dt>示例高度</dt><dd>同层 46 m</dd></div><div><dt>影响范围</dt><dd>2项任务 / 2家运营人</dd></div><div><dt>优先原则</dt><dd>应急任务先行</dd></div></dl>
              <div className="inline-note">样例阈值为30米，仅用于交互演示。真实间隔需按运行规则确定。</div>
              {!compare && !riskClosed && <button className="primary full" onClick={openCompare}>比较调整方案 <ArrowRight size={16} /></button>}
              {compare && <div className="compare-side-note"><GitBranch size={19} /><h3>先看改变，再做决定</h3><p>选择下方方案，在同一时刻查看不同飞行安排。</p></div>}
            </>}

            {panel === 'route' && <>
              <div className="detail-kicker"><span className="tag" style={{ color: selectedRoute.color }}><Dot color={selectedRoute.color} />{selectedRoute.business}</span><span className="micro">计划 v1 · 样例</span></div>
              <h2>{selectedRoute.id} · {selectedRoute.name}</h2><p className="lead">{selectedRoute.operator}</p>
              <div className="route-endpoints"><div><i /><span>{selectedRoute.origin}</span></div><div><i /><span>{selectedRoute.destination}</span></div></div>
              <dl className="detail-list"><div><dt>当前查看时刻</dt><dd>{clockLabel(time)}</dd></div><div><dt>预演高度</dt><dd>{Math.round(positionAt(selectedRoute, time, preview)[1])} m</dd></div><div><dt>计划航高</dt><dd>{selectedRoute.height}</dd></div><div><dt>任务优先级</dt><dd>{selectedRoute.id === 'E01' ? '应急优先' : '常规任务'}</dd></div><div><dt>位置类型</dt><dd>样例轨迹插值</dd></div></dl>
              {selectedRoute.id !== 'P02' && <button className="quiet full" onClick={openEvent}><TriangleAlert size={15} />查看关联事件 C-017<ChevronRight size={15} /></button>}
              <div className="inline-note">轨迹上的菱形标记随时间移动。拖动底部时间带，可以查看这一任务的飞行进程。</div>
            </>}

            {(panel === 'routes' || panel === 'plans') && <>
              <h2>{panel === 'plans' ? '混合运行计划' : '三条航路，一张园区'}</h2><p className="lead">配送、巡检、应急任务共享园区空域。</p>
              {routes.map((r, i) => <button className="route-card" onClick={() => selectRoute(r.id)} key={r.id}><div className="route-card-title"><span className="micro">0{i + 1}</span><Dot color={r.color} /><strong>{r.id} · {r.name}</strong><ArrowUpRight size={17} /></div><p>{r.origin}<br /><span>↓</span><br />{r.destination}</p><footer>{r.operator}<span>{panel === 'plans' ? (r.id === 'P02' ? '未关联冲突样例' : '关联事件 C-017') : r.height}</span></footer></button>)}
              <div className="inline-note">{panel === 'plans' ? '这里展示预设计划及关联事件，尚未执行真实计划预检。' : '点击航路进入详情，也可直接选择地图中的航迹或任务标记。'}</div>
            </>}

            {panel === 'coordination' && <CoordinationPanel state={state} dispatch={dispatch} onCompare={openCompare} />}

            {panel === 'audit' && <>
              <h2>每一步，都有来处</h2><p className="lead">C-017 · 本次演示的协调过程</p>
              {state.log.length === 0 ? <div className="empty-state"><ClipboardList size={32} strokeWidth={1} /><h3>还没有协调记录</h3><p>从冲突事件开始，比较并发送一份演示建议。</p><button className="quiet" onClick={openCompare}>开始体验 <ArrowRight size={15} /></button></div> : <><div className="audit-list">{state.log.map(entry => <article key={entry.index}><span className="audit-index">{String(entry.index).padStart(2, '0')}</span><div><small>建议 v{entry.version} · 演示步骤 {entry.index}</small><p>{entry.text}</p></div></article>)}</div><button className="quiet full" onClick={exportLog}><Download size={15} />导出演示记录</button><p className="footnote">刷新页面会重新开始演示，可先导出本次记录。</p></>}
            </>}

            {panel === 'site' && <>
              <h2>一座可以探索的园区</h2><p className="lead">围绕真实操作尺度建立的通用概念场地。</p><div className="site-figure"><img src="/images/campus-overview.png" alt="示范园区模型总览" /></div>
              <dl className="detail-list"><div><dt>场地尺度</dt><dd>600 × 420 m</dd></div><div><dt>建筑体量</dt><dd>10 组</dd></div><div><dt>起降设施</dt><dd>4 处</dd></div><div><dt>业务范围</dt><dd>配送 / 巡检 / 应急</dd></div><div><dt>位置基础</dt><dd>概念园区 · 局部坐标</dd></div></dl><p className="footnote">园区由本项目的 Blender 模型生成，后续可替换为实际场地。</p>
            </>}
          </div>
          <div className="side-footer"><span className="square-dot" />{state.phase !== 'draft' && state.version > 0 ? `C-017 / 建议 v${state.version}` : '通用场景 / 演示数据'}<span>AIRORDER</span></div>
        </aside>
      </div>

      {compare && <section className="comparison-panel" aria-label="方案比较">
        <div className="comparison-heading"><div><span className="section-number">02</span><h2>调整方案</h2><span className="muted">同一基准，看清每种选择的代价</span></div><div><span className="micro">预设方案 · 数值仅用于演示</span><button className="icon-button" aria-label="收起方案比较" onClick={() => setCompare(false)}><X size={17} /></button></div></div>
        <div className="candidate-grid">{candidatePlans.map(p => <article key={p.id} className={`candidate ${preview === p.id ? 'chosen' : ''} ${!p.feasible ? 'unavailable' : ''}`}>
          <div className="candidate-heading"><span className="candidate-letter">{p.letter}</span><h3>{p.name}</h3>{p.id === 'delay' ? <span className="recommend-tag">建议优先</span> : !p.feasible ? <span className="unavailable-tag"><Ban size={11} />不采用</span> : null}</div>
          <p>{p.description}</p><div className="candidate-metrics"><div><label>配送延后</label><strong>{p.delay}</strong></div><div><label>航程变化</label><strong>{p.distance}</strong></div><div><label>能耗变化</label><strong>{p.energy}</strong></div></div>
          <div className="candidate-bottom"><span>{p.reason}</span><button disabled={!p.feasible || !['draft', 'rejected', 'stale'].includes(state.phase)} className={preview === p.id ? 'selected-plan' : ''} onClick={() => selectPlan(p.id)} aria-label={`预演${p.id === 'delay' ? '错峰' : p.id === 'reroute' ? '绕行' : '换层'}方案`}>{preview === p.id ? <><Check size={13} />预演中</> : <><Play size={11} />预演</>}</button></div>
        </article>)}</div>
        <div className="comparison-footer"><span><GitBranch size={14} />{selectedPlan ? `已选：${selectedPlan.name} · 需云程物流、园区应急共同确认` : '选择一个可行的样例方案，开始空间预演'}</span><button className="primary" disabled={!state.selected || state.phase !== 'draft'} onClick={() => { dispatch({ type: 'SEND' }); setPanel('coordination'); setCompare(false); setToast('演示建议已生成，未向外部系统发送'); }}><Send size={14} />发送协调建议（演示）</button></div>
      </section>}

      <section className="timeline" aria-label="时间预演控制">
        <div className="time-modes">{([{ id: 'current', name: '当前' }, { id: 'preview', name: '预演' }, { id: 'replay', name: '回放' }] as const).map(m => <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => { setMode(m.id); setPlaying(false); setTime(m.id === 'preview' ? 150 : 0); }}>{m.name}</button>)}</div>
        <button className="play-button" aria-label={playing ? '暂停预演' : '播放预演'} onClick={() => { if (time >= 600) setTime(0); if (mode === 'current') setMode('preview'); setPlaying(p => !p); }}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
        <div className="timeline-track"><div className="time-above"><span>{mode === 'preview' ? '未来预演' : mode === 'replay' ? '样例回放' : '样例当前'}<strong>{clockLabel(time)}</strong></span><span className="risk-time" onClick={() => { setTime(220); setMode('preview'); setPlaying(false); }} title="跳到事件时刻">{!riskClosed && <><i />预计接近 09:44:40</>}</span><span>8× 播放</span></div><input aria-label="预演时间" type="range" min="0" max="600" step="1" value={time} style={{ '--progress': `${time / 6}%` } as React.CSSProperties} onChange={e => { setTime(Number(e.target.value)); setPlaying(false); if (mode === 'current') setMode('preview'); }} /><div className="time-ticks"><span>09:41</span><span>09:43</span><span>09:45</span><span>09:47</span><span>09:49</span><span>09:51</span></div></div>
        <button className="timeline-reset" aria-label="重置时间" title="重置时间" onClick={() => { setTime(0); setPlaying(false); }}><RotateCcw size={16} /></button>
      </section>

      <div className="query-area">
        {queryOpen && <section className="query-results" aria-label="查询结果"><div className="section-head"><h3>样例对象检索</h3><button className="icon-button" aria-label="关闭查询" onClick={() => setQueryOpen(false)}><X size={15} /></button></div><p className="footnote">支持任务编号、运营人，以及“冲突”“比较方案”等表达。</p>{query.trim() ? results.length > 0 ? results.map(r => <button className="query-result" key={r.id} onClick={() => { if (r.kind === 'route') selectRoute(r.id as RouteId); else if (r.kind === 'compare') openCompare(); else openEvent(); }}><Search size={15} /><div><strong>{r.title}</strong><span>{r.detail}</span></div><ArrowUpRight size={16} /></button>) : <div className="query-empty"><h3>没有匹配的样例对象</h3><p>试试“D03”“应急”“冲突”或“比较方案”。</p></div> : <div className="query-suggestions">{['D03', '应急', '未来的冲突', '比较方案'].map(q => <button key={q} onClick={() => setQuery(q)}>{q}<ArrowUpRight size={13} /></button>)}</div>}<div className="query-disclaimer">当前为样例检索，尚未接入语言模型或外部运行系统。</div></section>}
        <form className="query-bar" onSubmit={e => { e.preventDefault(); setQueryOpen(true); }}><Search size={18} strokeWidth={1.3} /><input ref={searchRef} type="search" aria-label="查询飞机、任务和事件" placeholder="查询飞机、任务、事件，或输入运行问题" value={query} onFocus={() => setQueryOpen(true)} onChange={e => { setQuery(e.target.value); setQueryOpen(true); }} /><div className="query-shortcuts"><button type="button" onClick={openEvent}>风险解释</button><span /><button type="button" onClick={openCompare}>方案分析</button></div><kbd>Ctrl K</kbd></form>
      </div>
      <footer className="bottomline"><span><i />空序 AIRORDER <b>/</b> 交互原型 0.1</span><span>空间有序，运行有据。</span></footer>
    </main>

    <div className={`toast ${toast ? 'visible' : ''}`} role="status">{toast && <><Check size={15} />{toast}</>}</div>
    <dialog ref={settingsRef} className="modal"><div className="section-head"><h2>显示与演示设置</h2><button className="icon-button" aria-label="关闭设置" onClick={() => settingsRef.current?.close()}><X size={20} /></button></div><p>为当前电脑选择合适的显示精度。</p><label className="setting-row">渲染精度<select value={quality} onChange={e => setQuality(e.target.value as 'standard' | 'low')}><option value="standard">标准 · 柔和阴影</option><option value="low">轻量 · 关闭阴影</option></select></label><div className="divider" /><h3>重新体验</h3><p>重置本次演示的计划选择、回执与审计记录。</p><button className="quiet full" onClick={reset}><RotateCcw size={15} />重置整个演示</button></dialog>
    <dialog ref={helpRef} className="modal"><div className="section-head"><h2>探索空序</h2><button className="icon-button" aria-label="关闭帮助" onClick={() => helpRef.current?.close()}><X size={20} /></button></div><ol className="help-list"><li><strong>看见空间</strong><p>拖动旋转园区，滚轮缩放；点击航路标签查看任务，使用高度尺过滤航迹。</p></li><li><strong>比较改变</strong><p>打开 C-017 事件，比较错峰和绕行；拖动时间带，观察飞行位置变化。</p></li><li><strong>完成协调</strong><p>发送演示建议后，展开“演示控制”，逐个模拟确认、落实回执和运行观测。</p></li></ol><p className="footnote">Ctrl K 聚焦检索，Esc 关闭检索或对话框。所有数据均为预设样例，刷新会重新开始。</p></dialog>
  </div>;
}
