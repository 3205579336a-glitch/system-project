import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; // 请根据你项目中 lib/supabase.ts 的实际路径调整导入

// 1. 处理获取历史记录请求
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // 从 Supabase 中筛选当前 Session ID 的记录，按时间倒序排列
    const { data, error } = await supabase
      .from('mds_requests')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 将数据库字段映射为前端需要的格式
    const formattedRecords = data.map(item => ({
      id: item.id,
      partNumber: item.part_number,
      supplierCode: item.supplier_code,
      status: item.status,
      createdAt: new Date(item.created_at).toLocaleString('zh-CN', { hour12: false }).substring(0, 16).replace(/\//g, '-')
    }));

    return NextResponse.json({ success: true, records: formattedRecords });
  } catch (error) {
    console.error('Fetch MDS history error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 });
  }
}

// 2. 处理提交请求 (保存至 Supabase + 推送 Forms)
export async function POST(request: Request) {
  try {
    const { partNumber, supplierCode, action, sessionId,email } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // ── 环节 A：将数据持久化写入 Supabase 数据库 ──
    const { error: dbError } = await supabase
      .from('mds_requests')
      .insert([
        {
          part_number: partNumber,
          supplier_code: action === 'cancel' ? 'N/A' : supplierCode,
          action_type: action,
          status: 'New', // 初始状态设为 New
          session_id: sessionId,
          submitter_email: email // <--- 新增这行
          
        }
      ]);

    if (dbError) {
      console.error('Supabase 写入失败:', dbError);
      throw new Error('Database insert failed');
    }

    // ── 环节 B：推送至 Microsoft Forms ──
    const FORMS_SUBMIT_URL = "https://forms.office.com/formapi/api/f25493ae-1c98-41d7-8a33-0be75f5fe603/users/03e50a34-e0ea-4c54-ad8a-b1f6c26a7cc8/forms('rpNU8pgc10GKMwvnX1_mAzQK5QPq4FRMrYqx9sJqfMhUNzJDODBVREUwOUJSRE9IMkRCMjBBT1VYUS4u')/responses";

    let formActionText = action === 'cancel' ? "Delete" : "Request";

    const answersArray = [
      {
        questionId: "r3749d14481644f23a99c5338a500314c", // Action 操作类型
        answer1: formActionText 
      },
      {
        questionId: "re8bb47fc4eeb42e89c852f1d08316233", // 物料号 Part Number
        answer1: partNumber
      },
      {
        questionId: "rdbb086f5efb2404fb1b687ba41aaff64", // 供应商代码 Supplier Code
        answer1: supplierCode || "N/A"
      },
      {
        questionId: "rce020f288faf4a7d8851f6f9c1bd6386", // 提交人邮箱 Submitter Email
        answer1: email || "N/A"
      }
    ];

    const response = await fetch(FORMS_SUBMIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://forms.office.com',
        'Referer': 'https://forms.office.com/'
      },
      body: JSON.stringify({
        startDate: new Date().toISOString(),
        submitDate: new Date().toISOString(),
        answers: JSON.stringify(answersArray)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Forms 提交失败:", errorText);
      // 这里的策略：即使 Forms 失败，不破坏本地数据库已存入的事实，但向前端抛出提示
      return NextResponse.json({ success: true, warning: "Saved to local but failed to sync to Forms" });
    }

    return NextResponse.json({ success: true, message: "数据已成功同步至本地数据库与 Microsoft Forms" });

  } catch (error) {
    console.error('MDS API Error:', error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}