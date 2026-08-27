<p align="center">
  <img src="./assets/logo.gif" width="180" alt="汐汐挥挥尾巴">
</p>

<h1 align="center">汐汐 · 蓝鲸女仆</h1>

<p align="center">
  我给 DeepSeek Harness Web 做了一只蓝鲸女仆桌宠，叫汐汐。<br>
  她住在网页边上。任务开跑、等你确认、一轮结束或出了问题，她都会换个动作提醒你。
</p>

<p align="center"><strong>非官方同人插件，与 DeepSeek 官方无隶属、合作或背书关系。</strong></p>

## 汐汐会做什么

汐汐会跟着当前会话一起忙。任务状态一变，她也会有反应：

| 任务状态 | 汐汐的反应 |
| --- | --- |
| 开始或正在处理 | 开始工作，偶尔看看进度 |
| 等你确认 | 停下来等你，并冒泡提醒 |
| 一轮结束 | 告诉你这轮结束了，也会显示用了多久 |
| 子任务失败 | 垂下尾鳍，提醒你这里出了问题 |
| 暂时没事 | 安静待着，过一会儿会休息 |

你可以把她拖到顺手的位置。点一下会挥手，双击会跳一下。位置只记在当前浏览器里。

空白会话，或者 3 秒内结束的小动作，不会专门弹一个“结束”提醒；但子任务出了问题，她还是会提醒。

为了不乱报，汐汐只说自己能确定的状态。她不复述命令，也不会把“一轮结束”说成“任务成功”。提示语会轮换，尽量不连续重复。

## 余额和费用估算

点右下角的余额按钮，可以看：

- DeepSeek 账户当前余额
- 按本机当天余额变化估算的“今日约消费”
- 当前会话大约用了多少 DeepSeek API 费用

这些数字只适合做参考：

1. `API Key` 由 DSH 服务端从凭证服务读取，不会传给浏览器。余额和会话费用接口只能从本机访问；服务端会用这个 Key 请求已经配置好的 DeepSeek 兼容余额接口。
2. “今日约消费”根据本机当天每次查询之间的余额下降累计，不是官方账单。充值不会清零已经记录的消费；赠金变化，或其他设备和应用共用同一个 Key，都会影响结果。升级后的第一次查询只会建立基线，暂时不会显示估算。
3. “本会话已用”只统计来源可以确认为 `deepseek-official`、而且已经写进价格表的模型。未定价模型会明确标出，不会显示成 `¥0`。失败请求没有 usage、日志被裁剪或价格规则更新时，估算可能与官方账单不同，请以 DeepSeek 控制台为准。

估算时会按 DeepSeek 的峰谷价来算：北京时间周一至周五 09:00–12:00、14:00–18:00 使用高峰价，其余时间使用低谷价。价格以 [DeepSeek API 官方定价页](https://api-docs.deepseek.com/quick_start/pricing/) 为准。

## 安装

安装前需要 Node.js `^22.19.0` 或 `>=24.0.0`，以及可用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web profile。查看余额还要求这个 profile 已配置 `DEEPSEEK_API_KEY`；即使余额不可用，桌宠和任务提醒也能正常使用。

下面的命令固定使用本项目实测过的 DSH `0.1.1-rc.2`。电脑上没有全局 `dsh` 命令也可以直接运行：

```sh
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add github:yuxino/dsh-blue-whale-maid
```

装好以后，把正在运行的 DSH Web 停掉再开一次：

```sh
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 web
```

### 更新

```sh
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web update dsh-blue-whale-maid
```

更新后也要重启 DSH。Bundle、服务端逻辑、依赖或素材有变化时，只刷新网页不够。

### 卸载

```sh
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web remove dsh-blue-whale-maid
```

卸载后同样重启一次 DSH。

## 汐汐是谁

DeepSeek 官方用的是鲸鱼标志，但没有发布过鲸鱼娘的姓名、性别、服装或性格设定。汐汐沿用了此前蓝鲸女仆素材的长蓝发、女仆装和鲸尾造型，又重新做成了适合网页桌宠的 Q 版动作。她不是 DeepSeek 官方角色。

具体外观与表达边界见 [角色设定](./docs/character-bible.md)，美术来源与许可说明见 [CREDITS.md](./CREDITS.md)。

## 本地开发

```sh
npm run build   # 把 assets/spritesheet.webp 嵌入 lib/client.js
npm test        # 定价与会话费用回归测试
npm run check   # 构建、测试与语法检查
```

要让真实的 Web profile 使用当前仓库，从仓库根目录运行：

```sh
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add .
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 --profile web --dump-config
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 web --no-open
```

`add .` 会让 profile 通过本地链接使用当前仓库。改代码后先重新构建，再重启 DSH；如果修改了 `package.json`、依赖或 `cordis.patch.yml`，还要重新执行一次 `add .` 更新依赖信息。

`tools/sync-profile.sh` 只用于把浏览器 Bundle 同步到独立安装的 profile。如果 profile 已经通过本地链接指向当前仓库，脚本会跳过复制并给出提示。修改服务端、Bundle 或素材后仍需重启 DSH。

### 真实 DSH 验收

当前 `1.10.6` 已经在 DeepSeek Harness `0.1.1-rc.2` 的真实 Web profile 里实际跑过。图集、点击与拖动、气泡避让、任务提醒、余额和会话费用都逐项检查过；视口缩小到 `640 × 720` 时也没有布局问题。检查时浏览器控制台和 Host 日志均无报错。

## 署名与许可

- 汐汐以此前一版由 **simashui** 署名的蓝鲸女仆桌宠素材为视觉原型，重新制作了 Q 版动画。她不是 DeepSeek 官方角色。
- 插件代码使用 [MIT License](./LICENSE)；角色美术与衍生预览不在 MIT 范围内。DeepSeek 与 DeepSeek Harness 的名称、标志和商标权利仍归各自权利方所有。
- 定价引擎改编自 MIT 项目 [bpc-oss/dsh-web-billing](https://github.com/bpc-oss/dsh-web-billing)，完整声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
- 设计与资料来源说明见 [CREDITS.md](./CREDITS.md)。
