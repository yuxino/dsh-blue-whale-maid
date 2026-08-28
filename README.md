<p align="center">
  <img src="./assets/logo.gif" width="180" alt="蓝鲸女仆桌宠挥挥尾巴">
</p>

<h1 align="center">蓝鲸女仆桌宠</h1>

<p align="center">
  给 DeepSeek Harness Web 加一只会看任务状态、提醒你确认、顺便估算费用的蓝鲸女仆。
</p>

<p align="center">
  <a href="#安装"><strong>安装试试</strong></a> ·
  <strong>喜欢她就点右上角 ⭐ Star</strong>
</p>

<p align="center"><sub>非官方同人插件，与 DeepSeek 官方无隶属、合作或背书关系。</sub></p>

## 她会做什么

- **跟着任务一起动**：开始处理、忙碌和休息时会切换动作。
- **该找你时提醒你**：等待确认、任务结束或子任务失败时会冒泡。
- **告诉你这一轮用了多久**：只报告能确定的状态，不把“结束”说成“成功”。
- **可以互动**：拖到顺手的位置，单击挥手，双击跳一下。
- **顺手看费用**：查看 DeepSeek 余额，以及今日和当前会话的费用估算。

## 安装

需要 Node.js `^22.19.0` 或 `>=24.0.0`，以及可用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web profile。

```sh
npx --yes @deepseek-ai/dsh plugin --profile web add github:yuxino/dsh-blue-whale-maid
```

装好后重启 DSH Web：

```sh
npx --yes @deepseek-ai/dsh web
```

她会出现在网页右下角。余额功能还需要当前 profile 配置 `DEEPSEEK_API_KEY`；没有 Key 时，桌宠和任务提醒仍然能用。

## 费用说明

- API Key 由 DSH 服务端读取，不会传给浏览器；桌宠界面只访问本机接口。
- “今日约消费”根据本机当天的余额变化估算，不是官方账单。
- “本会话已用”只计算来源明确、价格已知的 DeepSeek 官方模型；最终费用以 [DeepSeek 控制台](https://platform.deepseek.com/usage) 为准。

<details>
<summary><strong>更新与卸载</strong></summary>

更新：

```sh
npx --yes @deepseek-ai/dsh plugin --profile web update dsh-blue-whale-maid
```

卸载：

```sh
npx --yes @deepseek-ai/dsh plugin --profile web remove dsh-blue-whale-maid
```

更新或卸载后都要重启 DSH Web。

</details>

<details>
<summary><strong>本地开发</strong></summary>

```sh
npm run build
npm test
npm run check
```

让 Web profile 直接使用当前仓库：

```sh
npx --yes @deepseek-ai/dsh plugin --profile web add .
npx --yes @deepseek-ai/dsh --profile web --dump-config
npx --yes @deepseek-ai/dsh web --no-open
```

修改代码后先重新构建，再重启 DSH。依赖或 `cordis.patch.yml` 有变化时，需要重新执行一次 `add .`。

</details>

## 关于

这个桌宠以此前由 **simashui** 署名的蓝鲸女仆素材为视觉原型，重新制作了适合网页桌宠的 Q 版动作。她不是 DeepSeek 官方角色。

- [角色设定](./docs/character-bible.md)
- [美术来源与许可](./CREDITS.md)
- [第三方代码声明](./THIRD_PARTY_NOTICES.md)
- [代码许可证](./LICENSE)

如果她让 DSH 好用了一点，欢迎点一下页面右上角的 ⭐ Star。这样我能知道，确实有人想让这个小插件继续更新。
