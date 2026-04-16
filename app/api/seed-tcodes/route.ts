import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import TCODE_DATA from '../../t-codes/data.json'; // 替换为你实际的 json 文件路径

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET() {
  try {
    // 为了防止重复插入，插入前先清空表（谨慎操作，仅用于初始化）
    // await supabaseAdmin.from('tcodes').delete().neq('id', 0);

    const { data, error } = await supabaseAdmin
      .from('tcodes')
      .upsert(TCODE_DATA, { onConflict: 'code' }); // 依据 code 查重

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'SAP T-codes seeded successfully!', data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}