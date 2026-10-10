import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const address = 'http://127.0.0.1:4173';

async function isRunning() {
  let response;
  try { response = await fetch(address, { signal: AbortSignal.timeout(1500) }); }
  catch { return false; }
  const content = await response.text();
  if (!response.ok || !content.includes('空序 AIRORDER')) {
    throw new Error('端口 4173 已被其他程序占用。请关闭占用该端口的程序后重试。');
  }
  return true;
}

try {
  if (!await isRunning()) {
    const vite = resolve(root, 'node_modules/vite/bin/vite.js');
    if (!existsSync(vite)) throw new Error('请先在 prototype 文件夹运行 npm ci 安装依赖。');
    if (!existsSync(resolve(root, 'dist/index.html'))) throw new Error('请先在 prototype 文件夹运行 npm run build 生成预览。');
    mkdirSync(resolve(root, 'artifacts'), { recursive: true });
    const out = openSync(resolve(root, 'artifacts/preview-server.log'), 'a');
    const child = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
      cwd: root, detached: true, stdio: ['ignore', out, out], windowsHide: true,
    });
    child.unref();
    closeSync(out);
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(r => setTimeout(r, 300));
      if (await isRunning()) { ready = true; break; }
    }
    if (!ready) throw new Error('预览服务未能启动，请查看 artifacts/preview-server.log。');
  }
  console.log(`空序交互原型已就绪：${address}`);
  if (process.platform === 'win32') {
    const browser = spawn('cmd.exe', ['/c', 'start', '', address], { detached: true, stdio: 'ignore', windowsHide: true });
    browser.unref();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
