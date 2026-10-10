export type Point = [number, number, number];
export type PlanId = 'delay' | 'reroute' | 'altitude';
export type RouteId = 'D03' | 'P02' | 'E01';
export type OperatorId = 'logistics' | 'emergency';
export interface Route {
  id: RouteId;
  name: string;
  business: string;
  operator: string;
  color: string;
  height: string;
  origin: string;
  destination: string;
  points: { time: number; position: Point }[];
}

// Local metre coordinates, Y up. All times/paths are authored demonstration fixtures.
export const routes: Route[] = [
  { id: 'D03', name: '园区配送', business: '配送', operator: '云程物流', color: '#83c5b5', height: '64 m', origin: 'P01 配送起降位', destination: 'E01 应急起降位', points: [
    { time: 0, position: [-225, 3, 117] }, { time: 30, position: [-239, 48, 69] },
    { time: 80, position: [-200, 64, 0] }, { time: 130, position: [-30, 64, -5] },
    { time: 180, position: [90, 64, -8] }, { time: 220, position: [184, 46, -30] },
    { time: 260, position: [203, 3, -45] },
  ] },
  { id: 'P02', name: '设施巡检', business: '巡检', operator: '巡翼运维', color: '#b0a3c9', height: '90 m', origin: 'P02 巡检起降位', destination: '园区周界', points: [
    { time: 0, position: [-244, 90, 132] }, { time: 90, position: [-248, 90, -41] },
    { time: 160, position: [-236, 90, -157] }, { time: 260, position: [-5, 90, -166] },
    { time: 360, position: [236, 90, -151] }, { time: 470, position: [246, 90, 126] },
    { time: 600, position: [84, 90, 159] },
  ] },
  { id: 'E01', name: '应急转运', business: '应急', operator: '园区应急', color: '#d8ba7e', height: '46–110 m', origin: '园区东北入口', destination: 'E01 应急起降位', points: [
    { time: 0, position: [299, 110, -154] }, { time: 100, position: [262, 100, -118] },
    { time: 180, position: [223, 64, -57] }, { time: 220, position: [198, 46, -30] },
    { time: 260, position: [203, 3, -45] },
  ] },
];

export const candidatePlans: { id: PlanId; letter: string; name: string; description: string; delay: string; distance: string; energy: string; feasible: boolean; reason: string }[] = [
  { id: 'delay', letter: 'A', name: '错峰 45 秒', description: 'D03 延后起飞，让应急任务先通过。', delay: '+45 s', distance: '不变', energy: '基本不变', feasible: true, reason: '保持应急时效，航路改动最少。' },
  { id: 'reroute', letter: 'B', name: '绕行东侧走廊', description: 'D03 沿东侧走廊绕行，延后进入起降区。', delay: '+26 s', distance: '+约240 m', energy: '+约8%', feasible: true, reason: '保留出发时刻，增加航程与能耗。' },
  { id: 'altitude', letter: 'C', name: '抬升 25 米', description: '调整巡航高度，保留原起降时窗。', delay: '不变', distance: '不变', energy: '+约2%', feasible: false, reason: '落地时窗仍重叠，无法消除本例冲突。' },
];

export const operators: { id: OperatorId; name: string; task: string }[] = [
  { id: 'logistics', name: '云程物流', task: 'D03 · 受调整任务' },
  { id: 'emergency', name: '园区应急', task: 'E01 · 关联优先任务' },
];

export type Phase = 'draft' | 'pending' | 'confirmed' | 'observing' | 'completed' | 'rejected' | 'stale';
export interface Coordination {
  selected: PlanId | null;
  phase: Phase;
  version: number;
  acks: Record<OperatorId, 'waiting' | 'confirmed' | 'rejected'>;
  feedback: Record<OperatorId, boolean>;
  timedOut: boolean;
  log: { text: string; version: number; index: number }[];
}
export type Action =
  | { type: 'SELECT'; plan: PlanId }
  | { type: 'ACK' | 'REJECT' | 'FEEDBACK'; operator: OperatorId; version: number }
  | { type: 'SEND' | 'WITHDRAW' | 'VERIFY' | 'RESET' | 'TIMEOUT' | 'INVALIDATE' };

export function initialCoordination(): Coordination {
  return { selected: null, phase: 'draft', version: 0, acks: { logistics: 'waiting', emergency: 'waiting' }, feedback: { logistics: false, emergency: false }, timedOut: false, log: [] };
}

function record(s: Coordination, text: string): Coordination {
  return { ...s, log: [...s.log, { text, version: s.version, index: s.log.length + 1 }] };
}

export function transition(s: Coordination, action: Action): Coordination {
  switch (action.type) {
    case 'RESET': return initialCoordination();
    case 'SELECT': {
      if (!['draft', 'rejected', 'stale'].includes(s.phase) || !candidatePlans.some(p => p.id === action.plan && p.feasible)) return s;
      return { ...s, selected: action.plan, phase: 'draft', timedOut: false };
    }
    case 'SEND': {
      if (s.phase !== 'draft' || !s.selected) return s;
      return record({ ...s, phase: 'pending', version: s.version + 1, acks: { logistics: 'waiting', emergency: 'waiting' }, feedback: { logistics: false, emergency: false }, timedOut: false }, '演示建议已生成，等待两家运营人确认');
    }
    case 'ACK': {
      if (s.phase !== 'pending' || action.version !== s.version || s.acks[action.operator] !== 'waiting') return s;
      const acks = { ...s.acks, [action.operator]: 'confirmed' as const };
      return record({ ...s, acks, phase: Object.values(acks).every(v => v === 'confirmed') ? 'confirmed' : 'pending' }, `${operators.find(o => o.id === action.operator)!.name}确认当前建议版本`);
    }
    case 'REJECT': {
      if (s.phase !== 'pending' || action.version !== s.version) return s;
      return record({ ...s, phase: 'rejected', acks: { ...s.acks, [action.operator]: 'rejected' } }, `${operators.find(o => o.id === action.operator)!.name}退回建议：需重新协调任务时窗（样例）`);
    }
    case 'FEEDBACK': {
      if (s.phase !== 'confirmed' || action.version !== s.version || s.feedback[action.operator]) return s;
      const feedback = { ...s.feedback, [action.operator]: true };
      return record({ ...s, feedback, phase: Object.values(feedback).every(Boolean) ? 'observing' : 'confirmed' }, `${operators.find(o => o.id === action.operator)!.name}返回落实回执（样例）`);
    }
    case 'VERIFY':
      return s.phase === 'observing' ? record({ ...s, phase: 'completed' }, '样例观测通过，事件归档') : s;
    case 'WITHDRAW':
      return s.phase === 'pending' ? record({ ...s, phase: 'draft', acks: { logistics: 'waiting', emergency: 'waiting' }, timedOut: false }, '已撤回当前建议，原回执不再参与确认') : s;
    case 'TIMEOUT':
      return s.phase === 'pending' && !s.timedOut ? record({ ...s, timedOut: true }, '确认超时，等待人工跟进；未视为同意') : s;
    case 'INVALIDATE':
      return ['pending', 'confirmed'].includes(s.phase) ? record({ ...s, phase: 'stale', acks: { logistics: 'waiting', emergency: 'waiting' }, feedback: { logistics: false, emergency: false } }, '基准计划已变更，当前建议失效，需重新比较') : s;
  }
}

export const phaseLabels: Record<Phase, string> = {
  draft: '方案预演', pending: '等待各方确认', confirmed: '各方已确认 · 待落实', observing: '已收落实回执 · 待观测', completed: '样例处置完成', rejected: '建议被退回', stale: '计划已变更 · 建议失效',
};

export function pathFor(route: Route, plan: PlanId | null = null): Route['points'] {
  if (route.id !== 'D03' || plan !== 'reroute') return route.points;
  return [...route.points.slice(0, 4), { time: 175, position: [50, 64, 90] as Point }, { time: 213, position: [270, 64, 80] as Point }, { time: 250, position: [268, 48, -35] as Point }, { time: 286, position: [203, 3, -45] as Point }];
}

export function positionAt(route: Route, time: number, plan: PlanId | null = null): Point {
  const pts = pathFor(route, plan);
  const t = time - (route.id === 'D03' && plan === 'delay' ? 45 : 0);
  if (t <= pts[0].time) return pts[0].position;
  if (t >= pts[pts.length - 1].time) return pts[pts.length - 1].position;
  const i = pts.findIndex(p => p.time >= t);
  const a = pts[i - 1], b = pts[i];
  const mix = (t - a.time) / (b.time - a.time);
  return a.position.map((v, axis) => v + (b.position[axis] - v) * mix) as Point;
}

export function visibleAt(point: Point, ceiling: number) { return point[1] <= ceiling; }
export function clockLabel(seconds: number) {
  const t = 9 * 3600 + 41 * 60 + Math.max(0, Math.round(seconds));
  return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map(x => String(x).padStart(2, '0')).join(':');
}

export interface QueryResult { id: string; title: string; detail: string; kind: 'route' | 'event' | 'compare' }
export function queryObjects(raw: string): QueryResult[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  if (/方案|比较|错峰|绕行/.test(q)) return [{ id: 'compare', title: 'C-017 · 调整方案比较', detail: '错峰、绕行与高度调整的预设样例', kind: 'compare' }];
  if (/冲突|风险|c-017|接近/.test(q)) return [{ id: 'C-017', title: '进近航段预计接近', detail: 'D03 / E01 · 09:44:40 · 预设事件', kind: 'event' }];
  return routes.filter(r => `${r.id} ${r.name} ${r.business} ${r.operator} ${r.origin} ${r.destination}`.toLowerCase().includes(q) || /运营人/.test(q)).map(r => ({ id: r.id, title: `${r.id} · ${r.name}`, detail: `${r.operator} · ${r.height}`, kind: 'route' }));
}
