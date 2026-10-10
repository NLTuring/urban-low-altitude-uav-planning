# 空序 AIRORDER

城市低空多机协同调度与航路规划决策平台，包含浏览器交互原型、园区三维模型、界面设计及项目文档。

当前原型演示“发现冲突 → 比较方案 → 协调确认 → 外部落实回执 → 运行观测 → 审计记录”的业务流程，使用预设航迹与样例数据。真实运行数据、运营人接口、优化算法、审批流程、账户权限和语言模型尚未接入。

![空序运行总览](prototype/artifacts/airorder-overview.png)

## 快速启动

安装支持 Vite 7 的 Node.js 版本（20.19+ 或 22.12+），然后在项目根目录运行：

```bash
cd prototype
npm ci
npm run dev
```

浏览器访问 <http://127.0.0.1:4173>。开发服务仅监听本机。

构建并预览生产版本：

```bash
npm run build
npm run preview
```

Windows 用户也可在安装依赖并完成构建后双击 `prototype/启动原型.cmd`，由脚本启动本地预览。详细体验步骤见 [原型说明](prototype/README.md)。

## 项目内容

| 路径 | 内容 |
| --- | --- |
| [prototype/](prototype/) | React、TypeScript、Vite、Three.js 交互原型及测试 |
| [design/](design/) | UI 与功能设计方案、概念草图和园区渲染图 |
| [design/blender/](design/blender/README.md) | Blender 原始工程、建模脚本与模型说明 |
| [design/models/](design/models/) | 园区 GLB 模型 |
| [_build/](./_build/README.md) | 项目文档生成与校验脚本 |
| 根目录 `.docx` / `.pdf` | 商业计划书样板、项目简介与 BP/PPT 编制指南 |

## 验证

在 `prototype` 目录运行：

```bash
npm run build
npm run test:coverage
npm run test:e2e
```

浏览器测试默认使用本机 Google Chrome。文档重新生成步骤和工具要求见 [文档生成说明](./_build/README.md)。

依赖目录、构建缓存、测试报告、运行日志和文档逐页预览未纳入版本控制；应用源码、依赖锁文件、模型、设计素材及根目录文档均保留。
