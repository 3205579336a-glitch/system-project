import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 服务端客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 🟢 GET 方法：获取所有 Case 并以 JSON 格式返回 (供前端使用或导出)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('system_cases')
      .select('*')
      .order('created_at', { ascending: false }); // 按时间倒序

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 🔵 POST 方法：批量将 JSON 格式的 Case 导入数据库
export async function POST(request: Request) {
  try {
    const cases = await request.json();

    // 校验传入的是否为数组
    if (!Array.isArray(cases)) {
      return NextResponse.json({ success: false, error: '必须传入一个 JSON 数组' }, { status: 400 });
    }

    // 执行 Supabase 批量插入
    const { data, error } = await supabase
      .from('system_cases')
      .insert(cases)
      .select();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: `成功批量导入 ${data.length} 条记录！`,
      data 
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}