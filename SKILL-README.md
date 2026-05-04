# BP Parser — Claude Code Skill

将创始人 BP（PDF / 图片 / 文字）自动解析并录入 **SVTR Feishu AI创投库**。

这是 BP Parser 的第二代方案，基于 Claude Code CLI Skill 实现，替代原 Chrome Extension 方案。无需打开浏览器、无需手动复制字段，直接在 Claude Code 对话框中丢文件即可完成录入。

---

## 适用场景

- 从微信群收到创始人 BP（PDF / PPT 截图 / 文字介绍）
- 创始人直接发来投资人 Deck
- 需要批量录入多份 BP

---

## 前置条件

| 条件 | 说明 |
|---|---|
| Claude Code CLI | 已安装并登录 |
| Feishu App 凭据 | `FEISHU_APP_ID` + `FEISHU_APP_SECRET`，在 `~/.claude/settings.json` 的 `env` 字段中配置 |
| Feishu 权限 | App 需在目标多维表格中添加为「可编辑」协作者，并开启 `bitable:app` 读写权限 |
| Python 3 | 系统已安装（用于调用飞书 API） |

### 配置 Feishu 凭据

在 `~/.claude/settings.json` 的 `env` 节中添加：

```json
{
  "env": {
    "FEISHU_APP_ID": "cli_xxxxxxxxxxxxxxxxx",
    "FEISHU_APP_SECRET": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

---

## 安装 Skill

将 `bp-parser/` 文件夹放置于 Claude Code skills 目录：

```
~/.claude/skills/bp-parser/SKILL.md
```

Claude Code 启动时会自动加载，无需额外配置。

---

## 使用方法

在 Claude Code 对话中，直接发送 BP 文件路径或粘贴文字即可触发：

**PDF 文件：**
```
file:///D:/Files/xwechat/msg/2026-04/founder_deck.pdf
```

**多份 BP 同时录入：**
```
file:///path/to/deck1.pdf  file:///path/to/deck2.pdf
```

**文字内容（微信群转发）：**
```
录入BP：XXX公司，做AI Agent，创始人张三，前Google，融资需求$2M Seed，邮箱zhang@xxx.com
```

Claude 会提取字段并展示预览表格，确认后自动调用飞书 API 写入。

---

## 字段映射

| 飞书字段 | 类型 | 说明 |
|---|---|---|
| `Full Name` | 文本 | 创始人姓名，优先英文拼写 |
| `Organization / Company` | 文本 | 公司名称 |
| `Current Title` | 文本 | 职位，如 CEO / CTO |
| `Work Email` | 文本 | 联系邮箱 |
| `WeChat ID` | 文本 | 微信号或手机号 |
| `常驻城市` | 文本 | 公司所在城市 |
| `Company / Project Name` | 文本 | 产品/项目名称 |
| `公司官网` | URL | 官网链接 |
| `LinkedIn` | URL | LinkedIn 主页 |
| `Company Overview` | 文本 | 1–3 句公司描述，保留原文语言 |
| `Management Team` | 文本 | 核心团队背景，保留原文语言 |
| `Applicant Type` | 单选 | `Founder / Entrepreneur` / `Investor / VC...` / `Industry & Service Partner` / `Other` |
| `Fundraising Target` | 单选 | `<$10W` / `$10w-$100W` / `$100W-$1000W` / `>$1000W`（W = 万美元） |
| `Primary Needs` | 多选 | `Capital Sprint：Fundraising support` / `GTM Sprint：Customer pilots` / `Venture Studio...` / `Other` |
| `Sectors of Interest` | 多选 | `AI` / `Global Expansion` / `Consumer` / `Other` |
| `当前产品阶段` | 单选（硬件限定） | `样品阶段` / `小规模量产` / `大批量量产` |
| `是否有海外（中国大陆）公司主体` | 单选 | `已有海外主体` / `正在注册中` / `没有` |
| `备注` | 文本 | 自动填入来源 + 日期，附上无法映射到选项的字段值 |

> **注意**：`Fundraising Target`、`Primary Needs`、`Sectors of Interest` 等为飞书**选择字段**，只能传入预设选项值，不能传入自由文本。BP 中的融资金额会自动换算为对应档位。

---

## 目标表格

- **飞书多维表格**：[SVTR AI创投库](https://svtrglobal.feishu.cn/base/On0sb12czaZzlksCKZNcEbJ3nGf?table=tbl48MxPN0AUYNoc&view=vewNhBX7cO)
- App token：`On0sb12czaZzlksCKZNcEbJ3nGf`
- Table ID：`tbl48MxPN0AUYNoc`

---

## 与 Chrome Extension 方案对比

| | Chrome Extension（v1） | Claude Code Skill（v2） |
|---|---|---|
| 触发方式 | 手动点击扩展图标 | 在 Claude Code 对话中丢文件 |
| 支持格式 | PDF、文字粘贴 | PDF、图片（OCR）、.docx、文字、URL |
| 批量处理 | 不支持 | 支持多文件同时录入 |
| 字段智能提取 | Claude API（需在扩展中输入 Key） | Claude Code 原生 |
| 写入方式 | 浏览器自动填写飞书表单 | 飞书 Open API 直接写入 |
| 维护成本 | 飞书表单 UI 改版需更新 content.js | 飞书 API 字段名变更时更新 SKILL.md |

---

## 文件结构

```
~/.claude/skills/bp-parser/
└── SKILL.md          # Skill 主逻辑（字段映射、API 调用步骤）
```

---

## 常见问题

**Q：录入后飞书里某些字段是空的？**  
A：`Fundraising Target` 等选择字段只接受预设选项值，如果 BP 中的金额无法匹配会归入 `备注`。可手动在飞书中补选。

**Q：403 Permission Denied？**  
A：检查 Feishu App 是否已添加为该多维表格的可编辑协作者，以及 `bitable:app` 权限是否已发布。

**Q：中文字段 API 报错？**  
A：Skill 使用 Python `urllib` + `ensure_ascii=False` 处理，不用 curl，避免 shell 编码问题。如仍报错，检查 token 是否过期（有效期 2 小时）。

**Q：PDF 无法读取？**  
A：需安装 `pypdf`：`pip install pypdf`。扫描件 PDF 暂不支持 OCR，建议转为图片后录入。
