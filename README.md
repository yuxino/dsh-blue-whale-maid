<p align="center">
  <img src="./assets/logo.gif" width="180" alt="汐汐挥挥尾巴">
</p>

<h1 align="center">汐汐 · 蓝鲸女仆</h1>

<p align="center">
  一只住在 DeepSeek Harness 页面边缘的 Q 版蓝鲸女仆。<br>
  她会跟随会话状态改变动作，在任务需要确认、结束或失败时给出简短提醒。
</p>

<p align="center"><strong>非官方同人插件，与 DeepSeek 官方无隶属、合作或背书关系。</strong></p>

## 她会做什么

汐汐会跟着 DSH 会话状态换动作：

| 眼前发生的事 | 汐汐会做什么 |
| --- | --- |
| 任务开始 | 进入工作动作并显示任务标题 |
| 正在处理 | 保持工作动作，偶尔切换为检查动作 |
| 等你确认 | 进入等待动作并显示确认提醒 |
| 一轮工作结束 | 显示结束状态与耗时；其他会话可一键打开 |
| 子任务失败 | 尾鳍垂下并显示失败提醒 |
| 全部安静 | 保持待机，稍后进入休息动作 |

单击会挥手，双击会跳一下，也可以拖到喜欢的位置；位置只保存在浏览器本地。

空白会话和 3 秒内结束的短动作不会弹出普通结束提醒；新观察到的子任务失败仍会提醒。

提示只描述能够确认的状态，不复述命令，也不猜测任务结果。同组短句会轮换后再出现，避免连续重复。

## 余额和费用估算

右下角的余额按钮可以查看：

- DeepSeek 账户当前余额；
- 按本机当天连续观察到的余额下降累计的“今日约消费”；
- 当前会话的 DeepSeek API 费用估算。

说明：

1. API key 由 DSH host 端从凭证服务解析，不会下发给浏览器；host 只允许本机访问这两个财务接口，并把 key 作为 Bearer 凭证请求配置的 DeepSeek-compatible 余额接口。
2. “今日约消费”是本机逐段观察到的余额下降，不是官方账单；充值不会清掉已经观察到的消费，但赠金变化、其他设备或应用共用同一 key 仍可能影响结果。升级后的第一次查询只建立基线，暂不显示估算。
3. “本会话已用”只估算能确认来自 `deepseek-official` provider、且被内置价格表明确点名的 usage 事件；遇到未定价模型会直接标明，不会假装成 `¥0`。没有 usage 的失败请求、日志裁剪、政策更新或官方结算口径都可能造成偏差，请以 DeepSeek 控制台为准。

费用估算会区分工作日与周末的峰谷时段：北京时间周一至周五 09:00–12:00、14:00–18:00 按高峰价，其余时间按低谷价。价格来源以 [DeepSeek API 官方定价页](https://api-docs.deepseek.com/quick_start/pricing/) 为准。

## 安装

需要 Node.js `^22.19.0` 或 `>=24.0.0`，以及可用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web profile；余额功能还需要该 profile 能解析 `DEEPSEEK_API_KEY`。余额不可用时，桌宠与任务提醒仍可正常工作。

下面固定使用本项目实测过的 DSH `0.1.1-rc.2`，电脑上没有全局 `dsh` 命令也可以直接安装：

```sh
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add github:yuxino/dsh-blue-whale-maid
```

添加或更新 Bundle 后要停掉原先的 Web 进程，再重新启动：

```sh
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 web
```

### 更新

```sh
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web update dsh-blue-whale-maid
```

更新后同样要重启 DSH。Bundle、host 逻辑、依赖或素材变化都不能只靠刷新网页。

### 卸载

```sh
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web remove dsh-blue-whale-maid
```

卸载后重启 DSH。

## 汐汐是谁

DeepSeek 官方使用鲸形标志，但没有发布鲸鱼娘的姓名、性别、服装或人格设定。汐汐沿用此前蓝鲸女仆素材的长蓝发、女仆装和鲸尾造型，并为桌宠重新制作成 Q 版动作；她不是 DeepSeek 官方角色。

具体外观与表达边界见 [角色设定](./docs/character-bible.md)，美术来源与许可说明见 [CREDITS.md](./CREDITS.md)。

## 源码仓库开发

```sh
npm run build   # 把 assets/spritesheet.webp 嵌入 lib/client.js
npm test        # 定价与会话费用回归测试
npm run check   # 构建、测试与语法检查
```

把当前 checkout 接进真实 Web profile 时，从仓库根目录运行：

```sh
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add .
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 --profile web --dump-config
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 web --no-open
```

`add .` 会把 profile 依赖写成指向当前 checkout 的本地链接。改代码后先重新构建，再重启 DSH；改了 `package.json`、依赖或 `cordis.patch.yml` 时，再执行一次 `add .` 让 profile 重新对账。

`tools/sync-profile.sh` 只给“安装成独立副本”的 profile 同步浏览器 bundle；如果 profile 已经链接当前 checkout，它会直接说明无需复制。host、Bundle 与素材更新仍以重启 DSH 为准。

### 真实 DSH 验收

当前 `1.10.6` 已在真实的 DeepSeek Harness `0.1.1-rc.2` Web profile 验收：Q 版图集渲染、单击与双击动作、拖动和位置保存、贴纸气泡的屏幕边缘避让、真实任务的开始与结束提醒、余额卡片、当前会话费用，以及从桌面宽度缩到 `640 × 720` 的视口变化都通过；浏览器控制台与 Host 日志没有报错。

## 署名与许可

- 汐汐以此前一版由 **simashui** 署名的蓝鲸女仆桌宠素材为视觉原型，重新制作了 Q 版动画。她不是 DeepSeek 官方角色。
- 插件代码使用 [MIT License](./LICENSE)；角色美术与衍生预览不在 MIT 范围内。DeepSeek 与 DeepSeek Harness 的名称、标志和商标权利仍归各自权利方所有。
- 定价引擎改编自 MIT 项目 [bpc-oss/dsh-web-billing](https://github.com/bpc-oss/dsh-web-billing)，完整声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
- 设计与资料来源说明见 [CREDITS.md](./CREDITS.md)。
