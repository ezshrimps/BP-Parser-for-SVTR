// batch.js — 批量解析 BP PDF，输出 Markdown 报告
// 用法：node batch.js
// 复用 .env 中的 CLAUDE_API_KEY

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const BP_DIR   = 'D:\\Files\\BP_Files';
const MODEL    = 'claude-haiku-4-5-20251001';
const API_KEY  = process.env.CLAUDE_API_KEY;

if (!API_KEY || API_KEY.startsWith('sk-ant-api03-xxx')) {
  console.error('❌ 请在 .env 文件中填写有效的 CLAUDE_API_KEY');
  process.exit(1);
}

const PROMPT = `你是一个专业的商业计划书分析助手。请从以下Business Plan中提取信息，用于填写SVTR AI创投平台的入驻申请表单。

字段说明：
- identity（身份类型）：固定返回"创业者"
- name（姓名）：创始人或主要联系人的全名
- company（工作单位）：公司全称
- position（当前职务）：职位头衔，只保留实际职位如"创始人"、"CEO"，不要重复或拼接
- wechat（个人微信）：微信号，BP中未提及返回null
- services（所需服务）：从以下选项选择适用的（数组）：
  "AI创投库：数据与行业洞察"、"AI创投评：公司行业研究洞察"
  "AI创投会：线上线下闭门活动"、"AI创投营：找人找钱找方向"、"其他"
- email（公司邮箱）：公司邮箱，未提及返回null
- projectName（项目名称）：一句话介绍公司主要产品和服务（30字以内）
- companyIntro（公司介绍）：100-200字，包含成立时间、细分领域、核心产品、已有进展、核心优势
- team（管理团队）：列出创始人及核心团队，格式"姓名 | 职位 | 背景经历"，每人一行
- needs（主要诉求）：从以下选项选择（数组）："融资对接"、"客户试点"、"技术人才"、"国际化出海"、"媒体品牌"、"其他"
- cloudServices（云服务商）：从以下选项选择（数组），未提及返回[]："AWS"、"GCP"、"Azure"、"其他"
- fundingGoal（融资目标）：从"<10W"、"10w-100W"、"100W-1000W"、">1000W"中选一个，未提及返回null
- source（如何找到我们）：固定返回"其他"
- membership（是否是SVTR会员）：固定返回"不是"
- memberInterest（是否愿意了解SVTR会员）：固定返回"审核通过后再了解"

请严格按照以下JSON格式返回，不要包含任何其他文字：
{
  "identity": "创业者",
  "name": "姓名",
  "company": "公司名",
  "position": "CEO",
  "wechat": null,
  "services": ["AI创投营：找人找钱找方向"],
  "email": null,
  "projectName": "一句话产品介绍",
  "companyIntro": "公司介绍100-200字",
  "team": "张三 | CEO | 前谷歌工程师",
  "needs": ["融资对接"],
  "cloudServices": [],
  "fundingGoal": "100W-1000W",
  "source": "其他",
  "membership": "不是",
  "memberInterest": "审核通过后再了解"
}`;

async function parsePDF(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString('base64');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
          },
          { type: 'text', text: PROMPT }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude 返回格式错误');

  // Try direct parse first
  try { return JSON.parse(jsonMatch[0]); } catch (_) {}

  // Sanitize: fix unescaped control chars inside JSON strings
  const sanitized = jsonMatch[0]
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // strip illegal control chars
    .replace(/(?<=:\s*"[^"\\]*?)(\n)(?=[^"\\]*?")/g, '\\n')  // escape bare newlines in strings
    .replace(/(?<=:\s*"[^"\\]*?)(\t)(?=[^"\\]*?")/g, '\\t'); // escape bare tabs in strings

  try { return JSON.parse(sanitized); } catch (_) {}

  // Last resort: extract fields individually with regex
  const extract = (key) => {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    return m ? m[1].replace(/\\n/g, '\n') : null;
  };
  const extractArr = (key) => {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*(\\[[^\\]]*\\])`));
    try { return m ? JSON.parse(m[1]) : []; } catch { return []; }
  };
  return {
    identity: extract('identity') || '创业者',
    name: extract('name'),
    company: extract('company'),
    position: extract('position'),
    wechat: extract('wechat'),
    services: extractArr('services'),
    email: extract('email'),
    projectName: extract('projectName'),
    companyIntro: extract('companyIntro'),
    team: extract('team'),
    needs: extractArr('needs'),
    cloudServices: extractArr('cloudServices'),
    fundingGoal: extract('fundingGoal'),
    source: extract('source') || '其他',
    membership: extract('membership') || '不是',
    memberInterest: extract('memberInterest') || '审核通过后再了解',
  };
}

function formatMarkdown(index, filename, data) {
  const v = (val) => (val === null || val === undefined) ? 'null' : String(val);
  const arr = (a) => (Array.isArray(a) && a.length > 0) ? a.join('、') : '（无）';

  return `## ${index}. ${data.company || filename}

> 文件：\`${filename}\`

| 字段 | 内容 |
|------|------|
| 身份类型 | ${v(data.identity)} |
| 姓名 | ${v(data.name)} |
| 工作单位 | ${v(data.company)} |
| 当前职务 | ${v(data.position)} |
| 个人微信 | ${v(data.wechat)} |
| 公司邮箱 | ${v(data.email)} |
| 项目名称 | ${v(data.projectName)} |
| 融资目标 | ${v(data.fundingGoal)} |
| 如何找到我们 | ${v(data.source)} |
| 是否SVTR会员 | ${v(data.membership)} |
| 会员了解意向 | ${v(data.memberInterest)} |

**所需服务：** ${arr(data.services)}

**主要诉求：** ${arr(data.needs)}

**云服务商：** ${arr(data.cloudServices)}

**公司介绍：**

${data.companyIntro || '（未提取到）'}

**管理团队：**

${data.team ? data.team.split('\n').map(l => `- ${l.trim()}`).join('\n') : '（未提取到）'}

---`;
}

async function main() {
  // Get all PDFs
  const files = fs.readdirSync(BP_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  if (files.length === 0) {
    console.error(`❌ 在 ${BP_DIR} 中未找到任何 PDF 文件`);
    process.exit(1);
  }

  console.log(`📂 找到 ${files.length} 个 PDF 文件，开始解析...\n`);

  const results   = [];
  const failed    = [];
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  const dateStr   = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(BP_DIR, filename);
    process.stdout.write(`[${i + 1}/${files.length}] ${filename} ... `);

    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const data = await parsePDF(filePath);
        results.push({ index: i + 1, filename, data });
        console.log(`✓ ${data.company || '（公司名未识别）'}`);
        success = true;
        break;
      } catch (err) {
        const isRateLimit = err.message.includes('rate limit');
        if (isRateLimit && attempt < 3) {
          console.log(`⏳ 触发速率限制，等待 60s 后重试 (${attempt}/3)...`);
          await new Promise(r => setTimeout(r, 60000));
        } else {
          failed.push({ filename, error: err.message });
          console.log(`✗ 失败: ${err.message}`);
          break;
        }
      }
    }

    // Wait between requests to avoid rate limiting (large PDFs use many tokens)
    if (i < files.length - 1) await new Promise(r => setTimeout(r, 15000));
  }

  // Build markdown
  const lines = [
    `# SVTR BP 批量解析报告`,
    ``,
    `- **生成时间：** ${timestamp}`,
    `- **目录：** \`${BP_DIR}\``,
    `- **成功：** ${results.length} 个 / **失败：** ${failed.length} 个`,
    ``,
  ];

  if (failed.length > 0) {
    lines.push(`## ⚠️ 解析失败的文件`, ``);
    failed.forEach(f => lines.push(`- \`${f.filename}\`：${f.error}`));
    lines.push(``, `---`, ``);
  }

  results.forEach(({ index, filename, data }) => {
    lines.push(formatMarkdown(index, filename, data), ``);
  });

  const outputPath = path.join(BP_DIR, `SVTR_解析报告_${dateStr}.md`);
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

  console.log(`\n✅ 完成！报告已保存至：`);
  console.log(`   ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
