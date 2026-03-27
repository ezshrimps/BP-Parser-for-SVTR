require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3727;
const API_KEY = process.env.CLAUDE_API_KEY;

if (!API_KEY || API_KEY.startsWith('sk-ant-api03-xxx')) {
  console.error('❌ 请在 .env 文件中填写有效的 CLAUDE_API_KEY');
  process.exit(1);
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' })); // PDF base64 可能较大

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: 'claude-opus-4-6' });
});

// Main proxy endpoint
app.post('/parse', async (req, res) => {
  const { payload } = req.body;
  if (!payload) return res.status(400).json({ error: 'Missing payload' });

  const EXTRACTION_PROMPT = `你是一个专业的商业计划书分析助手。请从以下Business Plan中提取信息，用于填写SVTR AI创投平台的入驻申请表单。

字段说明：
- identity（身份类型）：固定返回"创业者"
- name（姓名）：创始人或主要联系人的全名
- company（工作单位）：公司全称
- position（当前职务）：职位头衔，只保留实际职位如"创始人"、"CEO"，不要重复或拼接
- wechat（个人微信）：微信号，BP中未提及返回null
- services（所需服务）：从以下选项选择适用的（数组），根据公司阶段推断：
  "AI创投库：数据与行业洞察"、"AI创投评：公司行业研究洞察"
  "AI创投会：线上线下闭门活动"、"AI创投营：找人找钱找方向"、"其他"
- email（公司邮箱）：公司邮箱，未提及返回null
- projectName（项目名称）：一句话介绍公司主要产品和服务（30字以内，简洁明了）
- companyIntro（公司介绍）：100-200字，包含：成立时间、细分领域、核心产品、已有进展、核心优势。从BP内容提炼，格式参考："[公司名]成立于[年份]，专注于[领域]，核心产品是[产品]，已[进展]，核心优势是[优势]。"
- team（管理团队）：列出创始人及核心团队，格式："姓名 | 职位 | 背景经历"，每人一行
- needs（主要诉求）：从以下选项选择适用的（数组），根据BP内容推断：
  "融资对接"、"客户试点"、"技术人才"、"国际化出海"、"媒体品牌"、"其他"
- cloudServices（当前正在使用的云服务商）：从以下选项选择（数组），BP中未提及返回空数组[]：
  "AWS"、"GCP"、"Azure"、"其他"
- fundingGoal（融资目标）：从以下选项选择一个，根据BP中融资金额推断：
  "<10W"、"10w-100W"、"100W-1000W"、">1000W"，未提及返回null
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
  "team": "张三 | CEO | 前谷歌工程师\n李四 | CTO | 清华计算机博士",
  "needs": ["融资对接"],
  "cloudServices": [],
  "fundingGoal": "100W-1000W",
  "source": "其他",
  "membership": "不是",
  "memberInterest": "审核通过后再了解"
}`;

  let messageContent;
  if (payload.type === 'pdf') {
    messageContent = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: payload.base64
        }
      },
      { type: 'text', text: EXTRACTION_PROMPT }
    ];
  } else {
    messageContent = `${EXTRACTION_PROMPT}\n\nBusiness Plan 内容：\n\n${payload.text}`;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: messageContent }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `HTTP ${response.status}`;
      console.error('Anthropic API error:', msg);
      return res.status(response.status).json({ error: msg });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Claude 返回格式错误，无法解析 JSON' });
    }

    const data = JSON.parse(jsonMatch[0]);
    console.log(`✓ 解析完成: ${data.company || '(公司未识别)'} - ${data.name || '(姓名未识别)'}`);
    res.json({ success: true, data });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ BP Parser 服务已启动: http://127.0.0.1:${PORT}`);
  console.log(`   健康检查: http://127.0.0.1:${PORT}/health`);
  console.log('   等待 Extension 请求...\n');
});
