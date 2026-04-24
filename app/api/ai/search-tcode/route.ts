import { NextResponse } from 'next/server';

// 🚨 禁用 SSL 验证（仅建议在公司内网/代理环境下使用）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 🌟 升级版的 Prompt，让 AI 同时兼顾 T-code 和 培训资源
const SYSTEM_PROMPT = `
你是一个世界级的 SAP 业务路由与企业培训专家。
你的任务是：根据用户的自然语言提问（业务场景、俗语、甚至抱怨），从我提供的【T-code 目录】和【培训资源目录】中，分别找出最匹配的项目。

【严格输出规则】
1. 只能输出纯 JSON 对象，绝不允许输出任何其他文字、Markdown 标记或反引号！
2. JSON 结构必须严格如下：
{
  "tcodes": ["ME51N", "ZMFM_FIRM_UPD"], // 最多匹配 1到5个 相关的 T-code 代码
  "learningIds": ["learn_abc123", "learn_xyz789"] // 最多匹配 1到3个 相关的培训资源 ID
}
3. 如果某一项完全找不到相关内容，请在对应字段输出空数组 []。
`;

export async function POST(req: Request) {
  try {
    const aiKey = process.env.DASHSCOPE_API_KEY;
    if (!aiKey) throw new Error('服务器未配置阿里云 API Key');

    // 🌟 接收前端传来的 搜索词、压缩后的 tcode目录、压缩后的培训资料目录
    const { query, tcodeCatalog, learningCatalog } = await req.json();

    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen3.6-plus',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          // 将两种目录都喂给大模型
          { 
            role: 'user', 
            content: `【可用 T-code 目录】\n${JSON.stringify(tcodeCatalog)}\n\n【可用培训资源目录】\n${JSON.stringify(learningCatalog)}\n\n【用户问题】\n${query}` 
          }
        ],
        temperature: 0.1, // 保持低温度，确保结果精确不发散
      })
    });

    if (!response.ok) { throw new Error('大模型请求失败'); }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    // 清理可能的 markdown 符号并解析
    const cleanJson = rawContent.replace(/```json|```/g, '').trim();
    const matchedResult = JSON.parse(cleanJson); // 解析为包含 { tcodes: [], learningIds: [] } 的对象

    // 🌟 返回结构化的数据给前端
    return NextResponse.json({ success: true, data: matchedResult });

  } catch (error: any) {
    console.error('[AI Search Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}