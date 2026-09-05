# Project Context

## 项目目标

为 Cambridge English Pre A1 Starters 学习者提供一个简单、适合手机使用的每日英语听写工具。学习者每天完成一组新词和一组按记忆曲线到期的复习词。

## 已确认的产品规则

### 词库

- 词库来自用户提供的 Cambridge Starters A–Z Word List 图片。
- 当前程序内置 495 个词条。
- 英美表达、斜杠变体和括号说明保留在显示文本中。
- 发音时去掉括号说明，并优先读取斜杠前的表达。

### 每日学习

- 默认每天最多新学 5 个词，建议总量 15 个。
- 到期复习全部显示，按到期日期从早到晚排列，不设硬上限。
- 尚未开启的新词按实际拼写字母数从少到多安排；空格、标点、括号说明和斜杠后的变体不计入首个拼写长度，同长度词沿用词库顺序。
- 升级时重新评估当天计划，保留已完成项目和记忆记录。未完成的新词仍可再次安排，不会因显示过而永久跳过。
- 用户只输入每日新词上限（1–20），查看建议、可下调、确认后才保存。建议总量=max(10, 新词上限×3)。
- 修改数量后，当天已经完成的词必须保留。
- 复习词不足时，只显示实际到期的词。
- 新词数量=min(新词上限, max(0, 建议总量−当天复习数))；已完成新词始终保留。复习超量时暂停新词，显示全部复习并提示分批完成。

### 记忆曲线

- 新词首次完成后，下一次复习安排在 1 天后。
- 此后的间隔依次为 2、4、7、15、30、60 天。
- 完成 60 天阶段后，每次继续按 60 天安排巩固。
- 只有用户完成某个词时，才推进该词的复习阶段。

### 完成状态

- 用户可以输入听到的内容并检查，也可以点击“我会了”。
- 完成的词在当天列表和完整词库中划线。
- 每日全部完成后显示完成提示。

### Reset

- Reset 必须有确认提示。
- Reset 会清除学习记录、单词划线状态、复习阶段和自定义数量。
- Reset 后恢复新词上限 5、建议总量 15；兼容字段 reviewCount 仍为 5，但不再用于限制复习。

## 技术现状

- 单页静态应用，全部 HTML、CSS、JavaScript 和词库位于 `index.html`。
- 不依赖服务器数据库或登录系统。
- 使用 Web Speech API `speechSynthesis`，语言为 `en-GB`。
- 使用设备本地日期生成每日计划，不能改成 UTC 日期。
- 使用 `localStorage` 键 `starter-dictation-v2` 保存数据。
- 当前数据结构版本为 `4`，包含 `days`、`memory`、`settings`、`startedAt` 和同步世代信息。
- 旧版学习记录会在首次打开新版时迁移到记忆曲线结构。
- 正式网站部署在 Cloudflare Pages：<https://starter-daily-dictation.pages.dev>。
- 家庭同步使用 Cloudflare Pages Functions 与 D1；本机缓存仍是离线保护层。
- 旧客户端升级后第一次同步必须先在 D1 保存完整备份，再做并集合并与完整性校验。
- 普通同步不得用云端快照直接覆盖本机状态；Reset 使用递增世代隔离旧离线记录。
- 家庭同步启用后，前台页面每 5 秒拉取一次云端状态，并提供手动立即同步和云端版本/时间提示。
- 同步请求进行期间发生的本机操作必须排队再次上传，不能被较早返回的云端响应覆盖。
- 云端合并后必须重新评估当天到期复习词，并保留当天已完成项目。
- 时间模拟控件只能在 Cloudflare 预览域名或本地开发环境显示；测试日期随家庭同步码共享。正式域名必须隐藏且使用真实本地日期。

## 当前限制

- 未启用家庭同步时，学习记录不会跨设备同步。
- 浏览器可用的英语语音由设备系统决定。
- 网站当前没有账户、服务端数据库或家长管理界面。

## Work 与 Codex 协作约定

- ChatGPT Work 用于讨论需求、确认规则和验收界面。
- GitHub 是源代码和长期项目上下文的唯一版本来源。
- Codex 开始任务前应阅读本文件和 `AGENTS.md`。
- 每项功能使用独立分支；测试通过后再合并到 `main`。
- 未经明确要求，不直接部署正式环境。


## Daily review batches (supersedes prior unlimited daily-list rule)

Today is limited to the suggested total. Yesterday’s new words receive first-review priority; other reviews are oldest-due first. Preserve completed items even after lowering the target. Excess reviews remain in memory at their original dates and appear as a separate backlog count. Completing today succeeds even with backlog. Continue review explicitly adds up to five words; the per-day extraReview allowance defaults to zero and synchronizes by maximum, never sum. No automatic refill on completion or sync. Memory and existing dates are never reset.
