<p align="center">
  <img src="./assets/logo.gif" width="180" alt="蓝鲸女仆">
</p>

<h1 align="center">dsh-blue-whale-maid</h1>

<p align="center">把蓝鲸女仆搬进 DeepSeek Harness。陪你跑任务，也负责在任务结束时戳你一下。</p>

## 功能

- 任务完成 / 失败 / 等待确认时提醒，完成通知带耗时与音效、按状态配色（完成绿 / 失败红 / 等待琥珀），停留更久（12s）可 ✕ 手动关闭
- 主题取自蓝鲸女仆素材本色：海浪感蓝渐变白（#4854a6 → #7c8ce0 → 淡蓝白）
- 播报说人话：只点名用户起的会话标题（目录名/会话 id 自动匿名），工作中的播报是抽象状态短语，不报具体命令
- 任务跑太久会温柔提醒一句（不误判卡住）
- 全部空闲时打盹（zZz），有任务或点击就精神起来
- 本地陪伴成长：完成 / 庆祝累积分数，等级解锁专属台词
- 宠物右下角常驻 💰 icon：点它查 DeepSeek 余额、今日消耗、本会话费用（key 从 DSH 内部读取，不出机器）
- 单击挥手、双击跳跃、拖动移动；完成提醒可一键跳到对应会话

## 安装

```sh
dsh plugin --profile web add github:yuxino/dsh-blue-whale-maid
```

重启 `dsh web` 后刷新页面。

## 更新

```sh
dsh plugin --profile web remove dsh-blue-whale-maid
dsh plugin --profile web add github:yuxino/dsh-blue-whale-maid
```

更新后无需重启，约 1 秒自动生效。

## 卸载

```sh
dsh plugin --profile web remove dsh-blue-whale-maid
```

卸载后重启 `dsh web` 生效。

## 开发

```sh
node tools/embed.mjs          # 生成 lib/client.js（源码在 src/client.template.js）
./tools/sync-profile.sh       # 同步到已安装的 profile，约 1 秒自动热更
```

## Credits

蓝鲸女仆美术与元数据来自 [codex-pets.net](https://codex-pets.net/#/pets/blue-whale-maid)，原作者 **simashui**。代码使用 MIT；素材不属于 MIT 范围。详见 [CREDITS.md](./CREDITS.md)。
