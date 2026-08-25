<p align="center">
  <img src="./assets/logo.gif" width="180" alt="小鲸挥挥尾巴">
</p>

<h1 align="center">小鲸 · 蓝鲸女仆</h1>

<p align="center">
  一只住在 DeepSeek Harness 页面边缘的原创蓝鲸女仆。<br>
  她把算力当白饭，把等待叫焖饭，嘴上总想摸鱼，尾巴却会认真把每份工作端上桌。
</p>

<p align="center"><strong>非官方同人插件，与 DeepSeek 官方无隶属、合作或背书关系。</strong></p>

## 今天也有好好待命

小鲸会跟着 DSH 会话状态换动作，也只在该开口的时候说一句：

| 眼前发生的事 | 小鲸会做什么 |
| --- | --- |
| 任务开始 | 收起尾巴，认真开工 |
| 正在处理 | 原地忙碌，偶尔再检查一遍 |
| 等你确认 | 耐心等着，不把“等人”说成“卡死” |
| 一轮工作结束 | 如实报一声并显示耗时；其他会话可一键去看看 |
| 子任务失败 | 尾巴垂下来并如实提醒，不硬装成功 |
| 全部安静 | 四处看看，过一会儿才打盹 |

单击会挥手，双击会跳一下，也可以拖到喜欢的位置。陪伴分数只保存在浏览器本地；相处久了，开工时说话会更有默契。

为了不拿页面闪一下也来打扰你，空白会话和 3 秒内结束的短动作不会弹出普通结束提醒；新观察到的子任务失败仍会提醒。

台词不再轮播模型名和行业梗。小鲸的笑点来自真实状态：等待是“米还在焖”，复查是“怕夹生”，失败则会先承认这锅要重做。相同台词会轮换后再出现，少一点复读机味道。

## 米缸里还剩多少饭

右下角的余额小按钮可以查看：

- DeepSeek 账户当前余额；
- 按本机当天连续观察到的余额下降累计的“今日约消费”；
- 当前会话的 DeepSeek API 费用估算。

这里有三条很重要的小字：

1. API key 由 DSH host 端从凭证服务解析，不会下发给浏览器；host 只允许本机访问这两个财务接口，并把 key 作为 Bearer 凭证请求配置的 DeepSeek-compatible 余额接口。
2. “今日约消费”是本机逐段观察到的余额下降，不是官方账单；充值不会清掉已经观察到的消费，但赠金变化、其他设备或应用共用同一 key 仍可能影响结果。升级后的第一次查询只建立基线，暂不显示估算。
3. “本会话已用”只估算能确认来自 `deepseek-official` provider、且被内置价格表明确点名的 usage 事件；遇到未定价模型会直接标明，不会假装成 `¥0`。没有 usage 的失败请求、日志裁剪、政策更新或官方结算口径都可能造成偏差，请以 DeepSeek 控制台为准。

小鲸知道工作日与周末的峰谷差别：北京时间周一至周五 09:00–12:00、14:00–18:00 按高峰价，其余时间按低谷价。价格来源以 [DeepSeek API 官方定价页](https://api-docs.deepseek.com/quick_start/pricing/) 为准。

## 把小鲸领回家

需要 Node.js `^22.19.0` 或 `>=24.0.0`，以及可用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web profile；余额功能还需要该 profile 能解析 `DEEPSEEK_API_KEY`。余额不可用时，桌宠与任务提醒仍可正常工作。

下面固定使用本项目实测过的 DSH `0.1.1-rc.2`，这样哪怕电脑上没有全局 `dsh` 命令，也能直接把小鲸领回来：

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

## 小鲸是谁

DeepSeek 官方使用鲸形标志，但没有发布鲸鱼娘的姓名、性别、服装或人格设定。大家熟悉的蓝发、鲸尾、女仆、白饭与“聪明但想摸鱼”，来自社区不断叠加的二创文化。

本项目只保留这些抽象共识，重新设计了小鲸的脸、肩下双色分层发、米粒发扣、布片状鲸鳍耳、圆月短宽尾、炭灰维护裙、波浪围裙、动作与台词；没有把现有创作者的立绘或表情包拿来换皮。完整边界见 [角色圣经](./docs/character-bible.md)。

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

### 这条鲸真的在 Harness 里游过

当前版本已在真实的 DeepSeek Harness `0.1.1-rc.2` Web profile 验收：插件启动、素材渲染、单击与双击动作、拖动和位置保存、余额卡片、当前会话费用接口，以及从桌面宽度缩到 `640 × 720` 的视口变化都通过；浏览器控制台与 Host 日志没有报错。

## 署名与许可

- 小鲸的角色方案、美术与动画为本项目原创制作；不是 DeepSeek 官方素材。
- 插件与项目原创资产使用 [MIT License](./LICENSE)。DeepSeek 与 DeepSeek Harness 的名称、标志和商标权利仍归各自权利方所有。
- 定价引擎改编自 MIT 项目 [bpc-oss/dsh-web-billing](https://github.com/bpc-oss/dsh-web-billing)，完整声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
- 设计与资料来源说明见 [CREDITS.md](./CREDITS.md)。
