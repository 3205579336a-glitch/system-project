import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type AdminAction = 'Approve' | 'Complete' | 'Reject';

type AdminActionBody = {
  recordId?: unknown;
  batchId?: unknown;
  action?: unknown;
  comment?: unknown;
};

const ADMIN_FORMS_SUBMIT_URL =
  "https://forms.office.com/formapi/api/f25493ae-1c98-41d7-8a33-0be75f5fe603/users/03e50a34-e0ea-4c54-ad8a-b1f6c26a7cc8/forms('rpNU8pgc10GKMwvnX1_mAzQK5QPq4FRMrYqx9sJqfMhUN0w2OEM5UlIxMjcwRUNGNU9ZNDJRVkpOVi4u')/responses";

const statusByAction: Record<AdminAction, 'Processing' | 'Done' | 'Rejected'> = {
  Approve: 'Processing',
  Complete: 'Done',
  Reject: 'Rejected',
};

const isAdminAction = (value: unknown): value is AdminAction =>
  value === 'Approve' || value === 'Complete' || value === 'Reject';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('mds_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedRecords = (data ?? []).map(item => ({
      id: item.id,
      partNumber: item.part_number,
      supplierCode: item.supplier_code,
      actionType: item.action_type || 'request',
      status: item.status,
      submitterEmail: item.submitter_email || 'Unknown user',
      adminComment: item.admin_comment,
      batchId: item.batch_id,
      batchSize: item.batch_size || 1,
      batchIndex: item.batch_index || 1,
      createdAt: new Date(item.created_at)
        .toLocaleString('zh-CN', { hour12: false })
        .substring(0, 16)
        .replace(/\//g, '-'),
    }));

    return NextResponse.json({ success: true, records: formattedRecords });
  } catch (error) {
    console.error('Admin MDS fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdminActionBody;
    const recordId = typeof body.recordId === 'string' ? body.recordId.trim() : '';
    const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    if (!isAdminAction(body.action)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    if (!recordId && !batchId) {
      return NextResponse.json({ success: false, error: 'Missing recordId or batchId' }, { status: 400 });
    }

    const action = body.action;
    const newStatus = statusByAction[action];
    const query = supabase
      .from('mds_requests')
      .select('id, part_number, supplier_code, action_type, submitter_email, batch_id, batch_index');

    const { data: targetRows, error: fetchError } = batchId
      ? await query.eq('batch_id', batchId).order('batch_index', { ascending: true })
      : await query.eq('id', recordId);

    if (fetchError) throw fetchError;
    if (!targetRows || targetRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Target records not found' }, { status: 404 });
    }

    const targetIds = targetRows.map(row => row.id);
    const { error: dbError } = await supabase
      .from('mds_requests')
      .update({
        status: newStatus,
        admin_comment: comment || null,
      })
      .in('id', targetIds);

    if (dbError) throw dbError;

    const partNumbers = targetRows.map(row => row.part_number).join('\n');
    const submitterEmail = targetRows[0].submitter_email || 'Unknown user';
    const supplierCode = targetRows.map(row => row.supplier_code || 'N/A').join('\n');

    const answersArray = [
      {
        questionId: 'r79718e4d86f6488a84db23f79f683c7d',
        answer1: action,
      },
      {
        questionId: 'rd9328a1e9c2448ed993128b3516cc347',
        answer1: partNumbers,
      },
      {
        questionId: 'r2cf96687b47a4afe8d71946d0db9543b',
        answer1: submitterEmail,
      },
      {
        questionId: 'rc950a8096c324ced905135712a261831',
        answer1: supplierCode,
      },
      {
        questionId: 'r077975eefd3d41ff856583c753aeb281',
        answer1: comment || 'None',
      },
    ];

    const response = await fetch(ADMIN_FORMS_SUBMIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://forms.office.com',
        Referer: 'https://forms.office.com/',
      },
      body: JSON.stringify({
        startDate: new Date().toISOString(),
        submitDate: new Date().toISOString(),
        answers: JSON.stringify(answersArray),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Admin Forms submit failed:', errorText);
      return NextResponse.json({
        success: true,
        warning: 'Database updated, but email notification trigger failed',
        count: targetRows.length,
        batchId: batchId || targetRows[0].batch_id || null,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin action completed and notification triggered',
      count: targetRows.length,
      batchId: batchId || targetRows[0].batch_id || null,
    });
  } catch (error) {
    console.error('Admin action error:', error);
    return NextResponse.json({ success: false, error: 'Admin action failed' }, { status: 500 });
  }
}
