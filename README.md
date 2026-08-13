# dsh-blue-whale-maid

**蓝鲸女仆** —— 一个运行在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI（`dsh web`）里的桌面像素宠物插件。

她把 [codex-pets.net](https://codex-pets.net/#/pets/blue-whale-maid) 上的「蓝鲸女仆」带进了 DSH：一只蓝发、鲸尾、蕾丝女仆装的 Q 版小伙伴，平时在窗口里溜达，你干活时她乖乖等待，你点她她就挥手。

> ⚠️ **美术素材版权说明**：角色立绘与精灵图（`assets/spritesheet.webp` 等）全部来自
> [codex-pets.net](https://codex-pets.net/#/pets/blue-whale-maid)，
> 原作者为 **simashui**。本仓库的代码采用 MIT 协议，但**美术素材不适用该协议**，
> 请尊重原作者，勿将素材用于商业用途。详见 [CREDITS.md](./CREDITS.md)。

## 展示

运行在 DSH Web GUI 右下角的样子（气泡为内置的出处致谢提示）：

![在 DSH 中运行](./docs/running-in-dsh.png)

精灵图 11 行动画一览（每行取前 3 帧，素材为原图未修改）：

![动画一览](./assets/animation-strip.png)

## 功能

- 🐳 悬浮在 DSH 窗口上方，基于 `shell.overlay` 插槽，不遮挡底层交互（除宠物自身外点击穿透）；默认 144×156 的桌面宠物尺寸
- 🚶 待机呼吸、左右张望、**原地小跑**（Codex Pet v2 精灵图 11 行动画）——**不会自己乱跑**，只有按住拖动才会移动，松手停在原地
- 💼 **会话联动（对标 codex 的运作方式）**：
  - 任意会话运行中（agent 在工作）→ 「奔跑」动画 + 偶尔切「检查」+ 冒出小爱心
  - 会话卡在等你确认（审批/提问）→ 「等待」动画 + 偶尔挥手提醒
  - 长任务结束 → 「跳跃」庆祝
  - 切换会话 → 挥手打招呼
- 🖱️ 单击 → 挥手 + 爱心 + 台词；双击 → 跳跃庆祝；按住拖动 → 拎着她到处跑，松手落地
- 💬 中文台词气泡（含一次性出处致谢提示）
- 🔖 位置记忆（localStorage）、悬停显示隐藏按钮、隐藏后可随时召唤回来
- ♿ 尊重 `prefers-reduced-motion`（减少动态效果时保持静止）

## 精灵图布局

素材是标准 [Codex Pet v2 图集](http://codexpet.xyz/zh/spec/)（1536×2288，8 列 × 11 行，单格 192×208）：

| 行 | 状态 | 用途 |
|---|---|---|
| 0 | idle | 待机 |
| 1 | running-right | 向右走 |
| 2 | running-left | 向左走 |
| 3 | waving | 挥手（单击） |
| 4 | jumping | 跳跃（双击 / 长任务结束） |
| 5 | failed | 失败 |
| 6 | waiting | 等待（agent 工作中） |
| 7 | running | 跑步 |
| 8 | review | 检查 |
| 9-10 | look-directions | 左右张望 |

## 安装

插件是一个带浏览器端的 DSH 客户端插件包（host 端为空 `apply`，仅用于挂载进 Loader）。

```sh
# 1. 把插件装进 web profile（转发给 pnpm）
dsh plugin --profile web add file:/path/to/dsh-blue-whale-maid
#   或者从 GitHub 装：
dsh plugin --profile web add github:yuxino/dsh-blue-whale-maid
```

2. 在 `$DSH_HOME/profiles/web/cordis.patch.yml` 中把插件插入加载器：

```yaml
- insert:
    - id: dsh-blue-whale-maid
      name: dsh-blue-whale-maid
```

3. 重启 `dsh web`（加载器在启动时读取插件列表），刷新页面即可看到宠物。

### 开发热更

DSH 的 client-HMR 会每 500ms 轮询各客户端 bundle 的内容变化：修改**已安装副本**里的
`lib/client.js`（位于 `$DSH_HOME/profiles/web/node_modules/dsh-blue-whale-maid/lib/client.js`），
浏览器无需刷新、无需重启服务即可热切换。

从仓库源码重新构建并更新已安装副本：

```sh
node tools/embed.mjs                                   # 重新内联素材、生成 lib/client.js
dsh plugin --profile web add file:/abs/path/to/dsh-blue-whale-maid   # 重新复制进 profile
```

## 开发

```sh
node tools/embed.mjs   # 把 assets/spritesheet.webp 内联进 lib/client.js
node --check lib/client.js
```

`lib/client.js` 是生成产物（模板见 `src/client.template.js`），仓库直接提交生成结果，
保证「免构建安装」可用。

## 来源与许可

本仓库是对 [codex-pets.net](https://codex-pets.net) 上「蓝鲸女仆」宠物的 **DSH 移植**。

| 内容 | 来源 | 许可 |
|---|---|---|
| 代码（插件实现） | 本仓库 [yuxino](https://github.com/yuxino) 编写 | MIT |
| `assets/spritesheet.webp` 精灵图 | [codex-pets.net — Blue Whale Maid](https://codex-pets.net/#/pets/blue-whale-maid)，原作者 **simashui** | © simashui，未经原作者许可请勿商用 |
| `assets/poster.webp` / `assets/preview.webp` | 同上 | © simashui |
| `assets/pet.json` 元数据 | 同上（原样保留） | © simashui |
| 精灵图格式规范 | [Codex Pet 技术规范](http://codexpet.xyz/zh/spec/)（openai/codex 宠物 v2 图集） | 参考 |

更详细的来源说明与致谢见 [CREDITS.md](./CREDITS.md)。
