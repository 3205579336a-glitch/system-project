import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 1. 获取所有 MDS 请求记录 (Admin 视角)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('mds_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedRecords = data.map(item => ({
      id: item.id,
      partNumber: item.part_number,
      supplierCode: item.supplier_code,
      status: item.status,
      submitterEmail: item.submitter_email || '未知用户',
      adminComment: item.admin_comment,
      createdAt: new Date(item.created_at).toLocaleString('zh-CN', { hour12: false }).substring(0, 16).replace(/\//g, '-')
    }));

    return NextResponse.json({ success: true, records: formattedRecords });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 });
  }
}

// 2. 处理管理员审批动作
export async function POST(request: Request) {
  try {
    const { recordId, partNumber, submitterEmail, action, comment,supplierCode } = await request.json();

    // 确定新的状态
    let newStatus = '';
    if (action === 'Approve') newStatus = 'Processing';
    if (action === 'Complete') newStatus = 'Done';
    if (action === 'Reject') newStatus = 'New'; // 退回至初始状态

    // A. 更新 Supabase 数据库
    const { error: dbError } = await supabase
      .from('mds_requests')
      .update({ 
        status: newStatus,
        admin_comment: comment || null 
      })
      .eq('id', recordId);

    if (dbError) throw dbError;

    // B. 推送至 Microsoft Forms 以触发 Power Automate 发邮件
    // 替换为你刚刚抓到的真实 Admin Form 提交 URL
    const ADMIN_FORMS_SUBMIT_URL = "https://forms.office.com/formapi/api/f25493ae-1c98-41d7-8a33-0be75f5fe603/users/03e50a34-e0ea-4c54-ad8a-b1f6c26a7cc8/forms('rpNU8pgc10GKMwvnX1_mAzQK5QPq4FRMrYqx9sJqfMhUN0w2OEM5UlIxMjcwRUNGNU9ZNDJRVkpOVi4u')/responses"; 

    // 填入你抓到的真实题号 (questionId)
    const answersArray = [
      { 
        questionId: "r79718e4d86f6488a84db23f79f683c7d", // 操作类型：Approve / Complete / Reject
        answer1: action 
      },
      { 
        questionId: "rd9328a1e9c2448ed993128b3516cc347", // 物料号
        answer1: partNumber 
      },
      { 
        questionId: "r2cf96687b47a4afe8d71946d0db9543b", // 提交人邮箱
        answer1: submitterEmail 
      },
      { 
        questionId: "rc950a8096c324ced905135712a261831", // 供应商代码
        answer1: supplierCode 
      },
      { 
        questionId: "r077975eefd3d41ff856583c753aeb281", // 批注 (Comment)
        answer1: comment || "无" // 如果是 Approve/Complete 没有填 comment，则默认传 "无" 避免报错
      }
    ];

    const response = await fetch(ADMIN_FORMS_SUBMIT_URL, {
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
      console.error("Admin Forms 提交失败:", errorText);
      // 数据库已更新，即使触发邮件失败也返回成功，但在控制台留痕
      return NextResponse.json({ success: true, warning: "数据库已更新，但触发邮件通知失败" });
    }

    return NextResponse.json({ success: true, message: "审批处理成功，并已触发邮件通知" });

  } catch (error) {
    console.error('Admin Action Error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}