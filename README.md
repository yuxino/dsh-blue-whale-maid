<p align="center">
  <img src="./assets/logo.gif" width="180" alt="蓝鲸女仆桌宠挥挥尾巴">
</p>

<h1 align="center">蓝鲸女仆桌宠</h1>

<p align="center">
  给 DeepSeek Harness Web 加一只会跟随任务状态、在需要确认、结束或失败时提醒你，并显示费用估算的蓝鲸女仆。
</p>

<p align="center">
  <a href="#安装"><strong>安装试试</strong></a> ·
  <strong>喜欢她就点右上角 ⭐ Star</strong>
</p>

## 她会做什么

装好以后，她会待在 DSH Web 右下角。任务开始时跟着忙；轮到你确认、这一轮结束或者出了问题，她会换个动作，再冒个泡提醒你。

平时可以把她拖到顺手的位置。点一下，她会挥手；双击一下，她会跳起来。点旁边的余额按钮，还能看看 DeepSeek 余额、今天大概花了多少，以及当前会话用了多少钱。

她只说自己能确定的事。比如一轮结束了，她会告诉你“结束了”，不会擅自说“成功了”。

## 安装

需要 Node.js `^22.19.0` 或 `>=24.0.0`、`pnpm`，以及可用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web profile。下面沿用 DSH 官方的无版本号命令。

```sh
npx @deepseek-ai/dsh plugin --profile web add github:yuxino/dsh-blue-whale-maid
```

装好后重启 DSH Web：

```sh
npx @deepseek-ai/dsh web
```

余额与费用面板需要当前 profile 配置 `DEEPSEEK_API_KEY`；没有 Key 时，桌宠和任务提醒照常能用。

## 费用说明

- API Key 由 DSH 服务端读取，不会传给浏览器；桌宠界面只访问本机接口。
- “今日约消费”根据本机当天的余额变化估算，不是官方账单。
- “本会话已用”只计算来源明确、价格已知的 DeepSeek 官方模型；最终费用以 [DeepSeek 控制台](https://platform.deepseek.com/usage) 为准。

<details>
<summary><strong>更新与卸载</strong></summary>

更新：

```sh
npx @deepseek-ai/dsh plugin --profile web update dsh-blue-whale-maid
```

卸载：

```sh
npx @deepseek-ai/dsh plugin --profile web remove dsh-blue-whale-maid
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
npx @deepseek-ai/dsh plugin --profile web add .
npx @deepseek-ai/dsh --profile web --dump-config
npx @deepseek-ai/dsh web --no-open
```

修改代码后先重新构建，再重启 DSH。依赖或 `cordis.patch.yml` 有变化时，需要重新执行一次 `add .`。

</details>

如果她让 DSH 好用了一点，欢迎点一下页面右上角的 ⭐ Star。这样我能知道，确实有人想让这个小插件继续更新。
