# Starter Daily Dictation

一个面向 Cambridge English Pre A1 Starters 词汇的每日听写网页。网站会安排每日新词，并按照艾宾浩斯间隔复习到期词。

线上地址：<https://starter-daily-dictation.vercel.app>

## 功能

- 内置 495 个 Pre A1 Starters 词条
- 使用浏览器英式英语语音进行听写
- 新词与复习词数量可分别设置
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

项目使用 `vercel.json` 配置，可直接导入 Vercel 或使用 Vercel CLI 部署：

```bash
vercel
vercel --prod
```

## 数据说明

- 数据仅保存在访问设备的浏览器中，不会跨设备同步。
- 当前存储键为 `starter-dictation-v2`。
- 数据结构版本为 `3`；修改数据结构时必须保留向后迁移逻辑。

进一步的产品规则见 [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)，Codex 开发约束见 [AGENTS.md](AGENTS.md)。
