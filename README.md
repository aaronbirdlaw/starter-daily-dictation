# Starter Daily Dictation

一个面向 Cambridge English Pre A1 Starters 词汇的每日听写网页。网站会安排每日新词，并按照艾宾浩斯间隔复习到期词。

线上地址：<https://starter-daily-dictation.pages.dev>

## 功能

- 内置 495 个 Pre A1 Starters 词条
- 使用浏览器英式英语语音进行听写
- 新词与复习词数量可分别设置
- 尚未学习的新词按实际拼写字母数从少到多安排，同长度词按词库顺序出现
- 复习间隔为学习后第 1、2、4、7、15、30、60 天，之后每 60 天巩固
- 到期词超过每日复习上限时，优先安排逾期最久的词
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

测试覆盖初始学习计划、独立数量设置、艾宾浩斯复习推进、旧数据迁移和 Reset。

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
