import { test, expect } from '@playwright/test';

test('三维场景、方案预演与完整协调闭环', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('场景演示', { exact: true })).toBeVisible();
  await expect(page.locator('[data-scene-status="ready"]')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'artifacts/airorder-overview.png', animations: 'disabled' });
  await page.getByRole('button', { name: '查看冲突 C-017' }).click();
  await expect(page.getByRole('heading', { name: '进近航段预计接近' })).toBeVisible();
  await page.getByRole('button', { name: '比较调整方案' }).click();
  await page.getByRole('button', { name: '预演错峰方案' }).click();
  await expect(page.getByText('正在预演：错峰 45 秒')).toBeVisible();
  await page.screenshot({ path: 'artifacts/airorder-comparison.png', animations: 'disabled' });
  await page.getByRole('button', { name: '发送协调建议（演示）' }).click();
  await expect(page.getByText('等待各方确认', { exact: true })).toBeVisible();
  await page.getByText('演示控制', { exact: true }).click();
  await page.getByRole('button', { name: '模拟云程物流确认' }).click();
  await expect(page.getByText('等待各方确认', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '模拟园区应急确认' }).click();
  await expect(page.getByText('各方已确认 · 待落实', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/airorder-coordination.png', animations: 'disabled' });
  await page.getByRole('button', { name: '模拟云程物流落实回执' }).click();
  await page.getByRole('button', { name: '模拟园区应急落实回执' }).click();
  await expect(page.getByText('已收落实回执 · 待观测', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '模拟运行观测通过' }).click();
  await expect(page.getByText('样例处置完成', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '审计', exact: true }).click();
  await expect(page.getByText('样例观测通过，事件归档')).toBeVisible();
  expect(errors).toEqual([]);
});

test('高度、时间、查询和拒绝分支保持状态一致', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('slider', { name: '预演时间' }).fill('220');
  await expect(page.getByText('09:44:40', { exact: true }).first()).toBeVisible();
  await page.getByRole('slider', { name: '可见高度上限' }).fill('60');
  await expect(page.getByText('0–60 m', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '平面视图' }).click();
  await page.getByRole('searchbox').fill('D03');
  await page.getByRole('searchbox').press('Enter');
  await page.getByRole('region', { name: '查询结果' }).getByRole('button', { name: /D03.*园区配送/ }).click();
  await expect(page.getByRole('heading', { name: 'D03 · 园区配送' })).toBeVisible();
  await page.getByRole('button', { name: '关闭详情' }).click();
  await page.getByRole('button', { name: '协同', exact: true }).click();
  await page.getByRole('button', { name: '预演绕行方案' }).click();
  await page.getByRole('button', { name: '发送协调建议（演示）' }).click();
  await page.getByText('演示控制', { exact: true }).click();
  await page.getByRole('button', { name: '模拟云程物流拒绝' }).click();
  await expect(page.getByText('建议被退回', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新比较方案' }).click();
  await page.getByRole('button', { name: '预演错峰方案' }).click();
  await page.getByRole('button', { name: '发送协调建议（演示）' }).click();
  await expect(page.getByText('建议版本 v2', { exact: true })).toBeVisible();
});

test('常见办公屏幕中核心控制可用，未知查询不伪造回答', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByRole('searchbox').fill('现在下雨了吗');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByText('没有匹配的样例对象')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '协同', exact: true }).click();
  await expect(page.getByRole('button', { name: '预演错峰方案' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/airorder-1366.png', animations: 'disabled' });
});

test('园区可旋转、缩放并点选航路，轻量模式保留操作', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-scene-status="ready"]')).toBeVisible();
  const map = page.getByRole('img', { name: '可旋转和缩放的三维园区' });
  const label = page.getByRole('button', { name: '选择航路 D03' });
  await expect(label).toBeVisible();
  const before = await label.getAttribute('style');
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.76);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.44, box.y + box.height * 0.7, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => label.getAttribute('style')).not.toBe(before);
  const scale = page.locator('.map-scale>span');
  const width = (await scale.boundingBox())!.width;
  await page.mouse.wheel(0, -180);
  await expect.poll(async () => (await scale.boundingBox())!.width).toBeGreaterThan(width);
  await page.getByRole('button', { name: '复位视角', exact: true }).click();
  await label.click();
  await expect(page.getByRole('heading', { name: 'D03 · 园区配送' })).toBeVisible();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('combobox').selectOption('low');
  await page.getByRole('button', { name: '关闭设置' }).click();
  await expect(page.locator('[data-scene-status="ready"]')).toBeVisible();
});

test('模型加载失败时保留静态总览和业务流程', async ({ page }) => {
  await page.route('**/models/campus.glb', route => route.abort());
  await page.goto('/');
  await expect(page.getByText('三维视图暂不可用 · 当前显示静态总览')).toBeVisible();
  await expect(page.getByRole('img', { name: '园区静态总览' })).toBeVisible();
  await page.getByRole('button', { name: '查看冲突 C-017' }).click();
  await expect(page.getByRole('button', { name: '比较调整方案' })).toBeVisible();
});
