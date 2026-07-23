# GitHub Cron Dispatcher

Cloudflare Workers 定时触发 GitHub Actions workflow — 支持多仓库、自定义 `event_type`、可视化配置，无需修改代码即可增删目标仓库。

## 工作原理

```text
Cloudflare Cron ──→ Worker ──→ GitHub API (repository_dispatch) ──→ 各仓库 Actions
```

- Worker 通过 Cron 定时器触发 `scheduled()` 事件
- 向配置的每个 GitHub 仓库发送 `repository_dispatch` 请求
- 对应仓库的 workflow 监听 `repository_dispatch` 事件后自动运行

## 环境变量

### `GITHUB_TOKEN`（机密）

GitHub Personal Access Token，权限需勾选 `repo`（可触发私有仓库）。

[生成 Token →](https://github.com/settings/tokens)

### `TARGETS`（纯文本）

每行一个目标仓库，格式：

```
owner/repo
owner/repo/event_type   # 自定义 event_type，默认 cloudflare_cron_trigger
```

示例：

```
krisxu23/auto-renew-framework
krisxu23/Keepalive
```

以 `#` 开头的行会被忽略。

## GitHub YAML 配置

**每个目标仓库的 workflow 必须监听 `repository_dispatch` 事件**：

```yaml
on:
  workflow_dispatch:           # 保留手动触发
  repository_dispatch:
    types: [cloudflare_cron_trigger]  # 与 Worker 中的 event_type 一致
```

## 部署

### 方式一：Cloudflare Dashboard（推荐新手）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages**
2. 创建 Worker → 将 `worker.js` 代码粘贴到编辑器
3. **设置 → 变量** 添加：
   - `GITHUB_TOKEN` → 类型选 **机密**，值填你的 PAT
   - `TARGETS` → 类型选 **纯文本**，值填目标仓库列表
4. **设置 → 触发器 → Cron 触发器** 添加定时规则（如 `40 2,8,14,20 * * *`）

### 方式二：Wrangler CLI

```bash
npm install -g wrangler
wrangler login

# 设置机密变量
wrangler secret put GITHUB_TOKEN

# 部署
wrangler deploy
```

## Cron 表达式参考（UTC 时间）

| Cron 表达式 | 含义 |
|------------|------|
| `40 2,8,14,20 * * *` | 每天 UTC 02:40 / 08:40 / 14:40 / 20:40 |
| `0 */3 * * *` | 每 3 小时 |
| `0 0-14 * * *` | 北京时间 8-22 点每小时 |
| `0 * * * *` | 每小时整点 |
| `*/30 * * * *` | 每 30 分钟 |

## 手动测试

部署后访问 Worker URL（如 `https://github-cron-dispatcher.xxx.workers.dev`）即可手动触发一次并查看 JSON 结果：

```json
[
  {
    "target": "krisxu23/auto-renew-framework",
    "event_type": "cloudflare_cron_trigger",
    "status": 204,
    "ok": true
  },
  {
    "target": "krisxu23/Keepalive",
    "event_type": "cloudflare_cron_trigger",
    "status": 204,
    "ok": true
  }
]
```

`status: 204` 表示 GitHub 已接受请求，对应仓库的 Actions 将会运行。
