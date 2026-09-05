# Starter Daily Dictation

一个面向 Cambridge English Pre A1 Starters 词汇的每日听写网页。网站会安排每日新词，并按照艾宾浩斯间隔复习到期词。

线上地址：<https://starter-daily-dictation.pages.dev>

## 功能

- 内置 495 个 Pre A1 Starters 词条
- 使用浏览器英式英语语音进行听写
- 只设置每日新词上限（1–20），先查看总量建议，可降低新词量，确认后保存
- 尚未学习的新词按实际拼写字母数从少到多安排，同长度词按词库顺序出现
- 每次实际完成起，复习间隔依次为 1、2、4、7、15、30、60 天，之后每 60 天巩固
- 全部到期复习按到期时间排列，永不截断；复习多时自动减少或暂停新词
- 完成的词会划线，并显示在完整词库和学习进度中
- Reset 可清除全部学习记录、复习计划和自定义设置
- 学习进度保存在当前浏览器的 `localStorage` 中

## 本地运行

项目是无后端、无构建步骤的静态网页。

```bash
python3 -m http.server 4173
```

然后打开 <http://localhost:4173>。

## 测试

需要 Node.js 18 或更高版本。

```bash
npm install
npm test
```

测试覆盖初始学习计划、建议确认、到期复习不截断、自动减少新词、艾宾浩斯复习推进、旧数据迁移和 Reset。

## 部署

项目部署在 Cloudflare Pages，无需购买域名或服务器：<https://starter-daily-dictation.pages.dev>。

## 家庭同步部署配置

家庭同步使用 Cloudflare Pages Functions 与 D1。项目已包含 `wrangler.jsonc` 和 `schema.sql`；Pages 项目应绑定名为 `DB` 的 D1 数据库 `starter-daily-dictation-sync`。部署后，两台设备可通过相同的家庭同步码共享学习记录。

- 首次启用或旧版本升级时，服务端先把当前 `starter-dictation-v2` 原始状态保存到 `family_sync_backups`，再合并并校验导入结果。
- 页面刷新、恢复前台和重新联网都会“上传并合并后再返回”，不会直接用云端快照覆盖本机未上传记录。
- 启用家庭同步后，页面保持打开且位于前台时每 5 秒检查一次云端；也可点击“立即同步”，并查看云端版本和最后同步时间。
- 冲突会保留两边已完成单词；设置按最后修改时间处理。
- Reset 使用递增的同步世代，防止另一台离线设备把旧进度恢复回来。
- 云端同步到新的到期词后，会重新计算当天复习列表，同时保留当天已完成内容。
- Cloudflare 预览域名和本地开发环境提供“时间流逝模拟”面板；启用家庭同步后测试日期也会在设备间同步。正式域名不会显示或采用模拟日期。

## 数据说明

- 未启用家庭同步时，数据仅保存在访问设备的浏览器中；启用后同时保留本机缓存和 D1 云端记录。
- 当前存储键为 `starter-dictation-v2`。
- 数据结构版本为 `4`，兼容迁移版本 3 和更早记录。

进一步的产品规则见 [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)，Codex 开发约束见 [AGENTS.md](AGENTS.md)。


## 自动学习量

建议总量为 `max(10, 新词上限 × 3)`，这是起步参数，不是科学定值或严格每日上限。每天先列出全部到期复习，再用建议总量的剩余额度安排新词，最多不超过新词上限。已完成项目始终保留，可能使当天超过建议量。新词不足时不拿已学词补数。

“总量太多”将建议的新词上限降至约 60%（至少减少 1 个，最低 1 个）；只有确认才保存。最低建议总量为 10，进一步降低新词会减少后续新增负担，但不隐藏到期任务。保留旧 `reviewCount` 字段用于兼容旧记录，新客户端不再用它截断复习，无须清空或重置家庭记录。

## Daily review batches (supersedes prior unlimited daily-list rule)

Today is limited to the suggested total. Yesterday’s new words receive first-review priority; other reviews are oldest-due first. Preserve completed items even after lowering the target. Excess reviews remain in memory at their original dates and appear as a separate backlog count. Completing today succeeds even with backlog. Continue review explicitly adds up to five words; the per-day extraReview allowance defaults to zero and synchronizes by maximum, never sum. No automatic refill on completion or sync. Memory and existing dates are never reset.
