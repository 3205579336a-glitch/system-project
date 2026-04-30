import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: 获取所有工单 (用于 Dashboard 统计和列表展示)
export async function GET() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

// POST: 提交新工单
export async function POST(request: Request) {
  const body = await request.json();
  
  // 生成唯一的 Case ID (例如 TKT-20240430-001)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.floor(1000 + Math.random() * 9000);
  const caseId = `TKT-${dateStr}-${randomStr}`;

  const { data, error } = await supabase
    .from('support_tickets')
    .insert([{ ...body, case_id: caseId }])
    .select();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data[0] });
}