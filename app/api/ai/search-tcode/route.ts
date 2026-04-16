import { NextResponse } from 'next/server';
// 🚨 禁用 SSL 验证（仅建议在公司内网/代理环境下使用）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const SYSTEM_PROMPT = `
你是一个世界级的 SAP 业务路由专家。
你的任务是：根据用户的自然语言提问（业务场景、俗语、甚至抱怨），从我提供的 T-code 目录中，找出最匹配的 1 到 5 个 T-code。

【严格输出规则】
1. 只能输出纯 JSON 数组，包含匹配的 T-code 字符串。绝不允许输出任何其他文字、Markdown 标记或反引号！
2. 示例格式: ["ME51N", "ZMFM_FIRM_UPD"]
3. 如果用户的提问在目录中完全找不到相关功能，请输出空数组: []
`;

export async function POST(req: Request) {
  try {
    const aiKey = process.env.DASHSCOPE_API_KEY;
    if (!aiKey) throw new Error('服务器未配置阿里云 API Key');

    const { query, catalog } = await req.json();

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
          // 将精简后的目录作为上下文喂给大模型
          { role: 'user', content: `【可用 T-code 目录】\n${JSON.stringify(catalog)}\n\n【用户问题】\n${query}` }
        ],
        temperature: 0.1, // 保持低温度，确保结果精确不发散
      })
    });

    if (!response.ok){ throw new Error('大模型请求失败');}

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    // 清理可能的 markdown 符号并解析
    const cleanJson = rawContent.replace(/```json|```/g, '').trim();
    const matchedCodes = JSON.parse(cleanJson);

    return NextResponse.json({ success: true, codes: matchedCodes });

  } catch (error: any) {
    console.error('[AI Search Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}