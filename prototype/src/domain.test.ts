import { describe, it, expect } from 'vitest';
import { initialCoordination, transition, candidatePlans, positionAt, clockLabel, queryObjects, routes, visibleAt } from './domain';

describe('跨运营人协调规则', () => {
  it('只预演方案不会更改运行基准或发送建议', () => {
    const next = transition(initialCoordination(), { type: 'SELECT', plan: 'delay' });
    expect(next.phase).toBe('draft');
    expect(next.version).toBe(0);
    expect(next.acks).toEqual({ logistics: 'waiting', emergency: 'waiting' });
  });
  it('缺少候选或候选不可行时不允许发送', () => {
    const s = initialCoordination();
    expect(transition(s, { type: 'SEND' })).toBe(s);
    expect(transition(s, { type: 'SELECT', plan: 'altitude' })).toBe(s);
    expect(candidatePlans.find(p => p.id === 'altitude')?.feasible).toBe(false);
  });
  it('逐个确认后仍需外部回执和运行观测', () => {
    let s = transition(initialCoordination(), { type: 'SELECT', plan: 'delay' });
    s = transition(s, { type: 'SEND' });
    expect(s.phase).toBe('pending');
    expect(transition(s, { type: 'VERIFY' })).toBe(s);
    expect(transition(s, { type: 'FEEDBACK', operator: 'logistics', version: 1 })).toBe(s);
    s = transition(s, { type: 'ACK', operator: 'logistics', version: 1 });
    expect(s.phase).toBe('pending');
    s = transition(s, { type: 'ACK', operator: 'emergency', version: 1 });
    expect(s.phase).toBe('confirmed');
    s = transition(s, { type: 'FEEDBACK', operator: 'logistics', version: 1 });
    expect(s.phase).toBe('confirmed');
    s = transition(s, { type: 'FEEDBACK', operator: 'emergency', version: 1 });
    expect(s.phase).toBe('observing');
    s = transition(s, { type: 'VERIFY' });
    expect(s.phase).toBe('completed');
    expect(s.log.at(-1)?.text).toContain('样例观测');
  });
  it('拒绝后可改选，旧版本回执不影响新版本', () => {
    let s = transition(initialCoordination(), { type: 'SELECT', plan: 'delay' });
    s = transition(s, { type: 'SEND' });
    s = transition(s, { type: 'REJECT', operator: 'logistics', version: 1 });
    expect(s.phase).toBe('rejected');
    s = transition(s, { type: 'SELECT', plan: 'reroute' });
    s = transition(s, { type: 'SEND' });
    expect(s.version).toBe(2);
    expect(transition(s, { type: 'ACK', operator: 'emergency', version: 1 })).toBe(s);
    expect(transition(s, { type: 'REJECT', operator: 'logistics', version: 1 })).toBe(s);
    expect(s.acks.logistics).toBe('waiting');
  });
  it('等待中不能换方案，撤回后可以', () => {
    let s = transition(initialCoordination(), { type: 'SELECT', plan: 'delay' });
    s = transition(s, { type: 'SEND' });
    expect(transition(s, { type: 'SELECT', plan: 'reroute' })).toBe(s);
    expect(transition(s, { type: 'SEND' })).toBe(s);
    s = transition(s, { type: 'WITHDRAW' });
    expect(s.phase).toBe('draft');
    expect(transition(s, { type: 'ACK', operator: 'logistics', version: 1 })).toBe(s);
  });
  it('计划变更和超时不会自动完成协调', () => {
    let s = transition(initialCoordination(), { type: 'SELECT', plan: 'reroute' });
    s = transition(s, { type: 'SEND' });
    s = transition(s, { type: 'TIMEOUT' });
    expect(s.phase).toBe('pending');
    expect(s.timedOut).toBe(true);
    s = transition(s, { type: 'INVALIDATE' });
    expect(s.phase).toBe('stale');
    expect(s.acks.emergency).toBe('waiting');
    expect(transition(s, { type: 'SEND' })).toBe(s);
    s = transition(s, { type: 'SELECT', plan: 'delay' });
    expect(s.phase).toBe('draft');
  });
  it('重复回执不增加日志，重置清除整个演示', () => {
    let s = transition(initialCoordination(), { type: 'SELECT', plan: 'delay' });
    s = transition(s, { type: 'SEND' });
    s = transition(s, { type: 'ACK', operator: 'logistics', version: 1 });
    expect(transition(s, { type: 'ACK', operator: 'logistics', version: 1 })).toBe(s);
    s = transition(s, { type: 'ACK', operator: 'emergency', version: 1 });
    expect(transition(s, { type: 'FEEDBACK', operator: 'emergency', version: 0 })).toBe(s);
    s = transition(s, { type: 'FEEDBACK', operator: 'emergency', version: 1 });
    expect(transition(s, { type: 'FEEDBACK', operator: 'emergency', version: 1 })).toBe(s);
    expect(transition(s, { type: 'RESET' })).toEqual(initialCoordination());
  });
  it('无流程时的异常事件不会制造记录', () => {
    const s = initialCoordination();
    for (const type of ['WITHDRAW', 'INVALIDATE', 'TIMEOUT', 'VERIFY'] as const) {
      expect(transition(s, { type })).toBe(s);
    }
  });
});

describe('空间与时间', () => {
  it('轨迹插值有边界，延迟预演使飞机留在起点', () => {
    const r = routes[0];
    expect(positionAt(r, -20)).toEqual(r.points[0].position);
    expect(positionAt(r, 10000)).toEqual(r.points.at(-1)?.position);
    expect(positionAt(r, 20, 'delay')).toEqual(r.points[0].position);
    expect(positionAt(r, 145, 'delay')).toEqual(positionAt(r, 100));
    expect(positionAt(r, 180, 'reroute')).not.toEqual(positionAt(r, 180));
    expect(positionAt(routes[1], 100, 'delay')).toEqual(positionAt(routes[1], 100));
  });
  it('高度切片包含边界，时间格式统一', () => {
    expect(visibleAt([0, 60, 0], 60)).toBe(true);
    expect(visibleAt([0, 61, 0], 60)).toBe(false);
    expect(clockLabel(0)).toBe('09:41:00');
    expect(clockLabel(220)).toBe('09:44:40');
    expect(clockLabel(600)).toBe('09:51:00');
  });
  it('查询能关联对象，对未知问题显示空结果', () => {
    expect(queryObjects('d03').some(x => x.id === 'D03')).toBe(true);
    expect(queryObjects('未来的冲突')[0].id).toBe('C-017');
    expect(queryObjects('比较方案')[0].kind).toBe('compare');
    expect(queryObjects('应急').some(x => x.id === 'E01')).toBe(true);
    expect(queryObjects('运营人').length).toBeGreaterThan(0);
    expect(queryObjects('')).toEqual([]);
    expect(queryObjects('现在下雨了吗')).toEqual([]);
  });
});
