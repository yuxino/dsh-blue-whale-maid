# 蓝鲸女仆桌宠

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 加一只会跟随任务状态、在关键时刻提醒你，并显示费用估算的蓝鲸女仆桌宠。

## 核心能力

- **跟随任务**：工作中、等待确认、一轮结束或出现失败时切换动作并冒泡提醒；必要时可跳回对应会话。
- **随手互动**：可以拖到顺手的位置，单击挥手，双击跳一下。
- **查看费用**：显示 DeepSeek 余额、今日约消费和当前会话费用估算。

## 安装

需要 Node.js `^22.19.0` 或 `>=24.0.0`、可用的 `pnpm`，以及 DeepSeek Harness `web` profile。

```sh
npx --yes @deepseek-ai/dsh plugin --profile web add github:yuxino/dsh-blue-whale-maid
npx --yes @deepseek-ai/dsh web
```

## 兼容与限制

- 仅用于 DeepSeek Harness Web。余额与费用面板需要当前 profile 配置 `DEEPSEEK_API_KEY`；没有 Key 时，桌宠和任务提醒仍可使用。
- API Key 只由 DSH 服务端读取，浏览器端只访问本机接口。
- “今日约消费”按本机当天的余额变化估算；“本会话已用”只计算来源明确、价格已知的 DeepSeek 官方模型。最终费用以 [DeepSeek 控制台](https://platform.deepseek.com/usage) 为准。
- “一轮结束”只表示任务已停止，不代表执行成功。
- 这是非官方社区桌宠；代码采用 MIT，角色美术不在 MIT 授权范围内，详见 [CREDITS](./CREDITS.md) 和 [LICENSE](./LICENSE)。

<details>
<summary><strong>更新与卸载</strong></summary>

```sh
# 更新
npx --yes @deepseek-ai/dsh plugin --profile web update dsh-blue-whale-maid

# 卸载
npx --yes @deepseek-ai/dsh plugin --profile web remove dsh-blue-whale-maid
```

更新或卸载后需要重启 DSH Web。

</details>
