import { NextResponse } from 'next/server';
import OpenAI from 'openai';
// 🚨 禁用 SSL 验证（仅建议在公司内网/代理环境下使用）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// 初始化客户端，修改 baseURL 指向阿里云的 DashScope 服务
const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || '',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

export async function POST(request: Request) {
  try {
    const { rawData } = await request.json();

    if (!rawData || !Array.isArray(rawData)) {
      return NextResponse.json({ success: false, error: '无效的数据格式' }, { status: 400 });
    }

    const prompt = `
    你是一个专业的数据清洗 API。请将以下来自 Excel 的原始数组，转换为符合目标数据库结构的 JSON 数据。
    
    【映射规则】：
    - "System" -> system
    - "ID" 或 "Case ID" -> 加前缀转换为 case_id (例如：系统如果是 ODC，ID 是 1，则输出 "ODC-001")
    - "Request Type" -> request_type
    - "Classification" -> classification
    - "Category" -> category
    - "Symptom" -> error_msg (保留完整的业务现象描述)
    - "Solution" -> solution (保留排查步骤)
    - "Requester" -> requester
    
    【AI 智能生成规则】：
    1. title: Excel 中没有标题。请你根据 "Symptom" 的内容，提取核心词，生成一个 15 字以内的精炼标题。
    2. priority: Excel 中没有优先级。请根据 "Classification" 和 "Symptom" 推断 (High/Medium/Low)。如果是 Bug/故障，通常是 High。
    3. handler_role: 统一默认填入 "System Key User"
    4. handler_name: 统一默认填入 "Zhenghang Xin"
    
    【原始数据】：
    ${JSON.stringify(rawData)}
    
    【重要输出格式】：
    必须只返回一个 JSON 对象，且包含一个 "cases" 键，其值为转换后的数组。
    例如：{"cases": [{"system": "ODC", "title": "..."}]}
    `;

    const response = await openai.chat.completions.create({
      model: 'qwen3.6-plus', // qwen-plus 性价比极高，处理此类任务绰绰有余
      messages: [
        { role: 'system', content: '你是一个擅长数据清洗和强制输出 JSON 格式的助手。' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }, // 强制 Qwen 输出标准 JSON
    });

    const responseText = response.choices[0].message.content || '{"cases": []}';
    
    // 解析 Qwen 返回的 JSON 字符串，并提取 cases 数组
    const parsedData = JSON.parse(responseText);
    const cleanData = parsedData.cases || [];

    return NextResponse.json({ success: true, data: cleanData });

  } catch (error: any) {
    console.error('Qwen 转换失败:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}