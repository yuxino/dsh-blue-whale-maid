<p align="center">
  <img src="./assets/preview.webp" width="180" alt="蓝鲸女仆">
</p>

<h1 align="center">dsh-blue-whale-maid</h1>

<p align="center">把蓝鲸女仆搬进 DeepSeek Harness。陪你跑任务，也负责在任务结束时戳你一下。</p>

![在 DSH 中运行](./docs/running-in-dsh.png)

## 功能

- 任务完成 / 失败 / 等待确认时，用动画和气泡提醒
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
node tools/embed.mjs
```

`src/client.template.js` 是源码模板，命令会把精灵图内联到 `lib/client.js`。

## Credits

蓝鲸女仆美术与元数据来自 [codex-pets.net](https://codex-pets.net/#/pets/blue-whale-maid)，原作者 **simashui**。代码使用 MIT；素材不属于 MIT 范围。详见 [CREDITS.md](./CREDITS.md)。
