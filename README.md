<p align="center">
  <img src="./assets/blue-whale-maid-v2.png" width="180" alt="蓝鲸女仆桌宠">
</p>

<h1 align="center">蓝鲸女仆桌宠</h1>

<p align="center">
  给 DeepSeek Harness Web 加一只会跟随任务状态、在需要确认、结束或失败时提醒你的蓝鲸女仆。
</p>

<p align="center">
  <a href="#安装"><strong>安装试试</strong></a> ·
  <strong>喜欢她就点右上角 ⭐ Star</strong>
</p>

## 她会做什么

装好以后，她会待在 DSH Web 右下角。任务开始时跟着忙；轮到你确认、这一轮结束或者出了问题，她会换个动作，再冒个泡提醒你。

平时可以把她拖到顺手的位置。点一下，她会晃一晃回应你；双击一下，她会跳起来。

她只说自己能确定的事。比如一轮结束了，她会告诉你“结束了”，不会擅自说“成功了”。

## 安装

需要 Node.js `^22.19.0` 或 `>=24.0.0`，以及可用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web profile。当前 2.0 发行版已在 DSH `0.1.1-rc.2` 完成安装、启动和界面验收。

```sh
npx --yes @deepseek-ai/dsh plugin --profile web add github:yuxino/dsh-blue-whale-maid
```

装好后重启 DSH Web：

```sh
npx --yes @deepseek-ai/dsh web
```

## 权限说明

2.0 版本只在 DSH Web 页面内运行，不读取文件、凭据或环境变量，也不自行发起网络请求。1.x 的余额与费用估算面板已移除，避免桌宠为了附加功能申请这些权限。

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

如果她让 DSH 好用了一点，欢迎点一下页面右上角的 ⭐ Star。这样我能知道，确实有人想让这个小插件继续更新。

项目代码与当前角色资产使用 MIT License；创作与历史来源说明见 [CREDITS.md](./CREDITS.md)。
