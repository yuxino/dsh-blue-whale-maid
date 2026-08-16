<p align="center">
  <img src="./assets/logo.gif" width="180" alt="蓝鲸女仆">
</p>

<h1 align="center">dsh-blue-whale-maid</h1>

<p align="center">把蓝鲸女仆搬进 DeepSeek Harness。陪你跑任务，也负责在任务结束时戳你一下。</p>

## 功能

- 任务完成 / 失败 / 等待确认时，用动画和气泡提醒，完成通知带耗时（「跑了 3 分 42 秒」）与轻快音效
- 任务跑太久（5 分钟+）会温柔提醒「还在忙呢，要看看吗？」（不武断判定卡住）
- 全部会话空闲时打盹（漂浮的 zZz），有任务或点击时精神起来
- 本地陪伴成长：完成/庆祝累积陪伴分，等级解锁专属开场台词（小鲸鱼 → 深海羁绊，纯计数无敏感数据）
- 工作中偶尔播报当前任务和命令
- 单击挥手、双击跳跃、拖动移动，位置会记住
- 完成提醒可直接跳到对应会话

## 安装

```sh
dsh plugin --profile web add github:yuxino/dsh-blue-whale-maid
```

重启 `dsh web` 后刷新页面即可。

悬停宠物可临时隐藏；卸载：

```sh
dsh plugin --profile web remove dsh-blue-whale-maid
```

## 开发

```sh
node tools/embed.mjs          # 把精灵图内联进 lib/client.js（源码模板在 src/client.template.js）
./tools/sync-profile.sh       # 把新产物同步进已安装的 profile 副本
```

改完 `lib/client.js` 后，DSH 的客户端 HMR 会在约 1 秒内自动热更——**无需重启 `dsh web`，也无需刷新页面**。

> 为什么需要 `sync-profile.sh`：`dsh plugin add` 会把插件以 *副本*（file: 依赖）形式装进 `node_modules`，改源仓库的文件不会同步到副本，HMR 因此看不到变化。该脚本只是把产物复制进副本，触发 HMR 轮询检测。默认同步 `web` profile，可 `DSH_PROFILE=<name>` 指定。

## Credits

蓝鲸女仆美术与元数据来自 [codex-pets.net](https://codex-pets.net/#/pets/blue-whale-maid)，原作者 **simashui**。代码使用 MIT；素材不属于 MIT 范围。详见 [CREDITS.md](./CREDITS.md)。
