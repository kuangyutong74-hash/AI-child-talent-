# data.example — 安全空种子数据

本目录包含 AI Talent Scout 的最小空数据模板。
这些文件不包含任何真实用户数据、密码、token 或聊天内容。

## 推荐初始化方式

```bash
npm run init-data
```

该命令会验证并安全复制模板文件到 `data/` 目录，不会覆盖已有文件。

## 手动初始化

```bash
cp -r data.example/* data/
```

## 重要说明

1. `data.example/` 是安全空种子，不是运行数据。
2. `data/` 中的内容不会被提交到 Git（已在 `.gitignore` 中配置）。
3. `data/` 可能包含个人信息，不应分享或提交。
4. 不要把生产数据复制回 `data.example/`。
5. `teacher-insight-reviews.json` 无需预先创建，首次合法审核操作时自动创建。
6. `teacher-binding-invitations.json` 初始化为 `[]`，不包含任何邀请或 token。
7. `teacher-binding-audit.jsonl` 初始化为空文件，不包含审计事件。
8. `teacher-report-narratives.json` 初始化为 `[]`，不包含任何叙事报告。
9. `teacher-safety-signals.json` 初始化为 `[]`，不包含任何安全信号记录。
10. `chat-log.jsonl` 初始化为空文件，不包含聊天日志。
11. `tip-favorites.json` 初始化为 `{}`，不包含预设收藏。
12. `tips.json` 初始化为 `[]`，不包含预设安全小贴士。
13. 建议部署时通过 `DATA_DIR` 环境变量使用独立持久化目录。
14. `npm run init-data` 不会覆盖已存在的文件，可以安全地重复运行。
15. 空种子不含默认用户，初始化后需要自行注册用户。
16. 不要把真实运行数据复制回 `data.example/`。
17. 初始化完成后共 12 个运行时文件。
