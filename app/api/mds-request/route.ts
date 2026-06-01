import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

type MDSAction = 'request' | 'cancel';

type MDSRequestBody = {
  partNumber?: unknown;
  supplierCode?: unknown;
  action?: unknown;
  sessionId?: unknown;
  email?: unknown;
};

type MDSDbRecord = {
  id: string;
  part_number: string;
  supplier_code: string;
  action_type: MDSAction;
  status: 'New' | 'Processing' | 'Done' | 'Rejected';
  created_at: string;
};

const FORMS_SUBMIT_URL =
  "https://forms.office.com/formapi/api/f25493ae-1c98-41d7-8a33-0be75f5fe603/users/03e50a34-e0ea-4c54-ad8a-b1f6c26a7cc8/forms('rpNU8pgc10GKMwvnX1_mAzQK5QPq4FRMrYqx9sJqfMhUNzJDODBVREUwOUJSRE9IMkRCMjBBT1VYUS4u')/responses";

const isVolvoEmail = (value: string) => /^[A-Z0-9._%+-]+@volvo\.com$/i.test(value);

const formatCreatedAt = (value: string) =>
  new Date(value).toLocaleString('zh-CN', { hour12: false }).substring(0, 16).replace(/\//g, '-');

const formatRecord = (item: MDSDbRecord) => ({
  id: item.id,
  partNumber: item.part_number,
  supplierCode: item.supplier_code,
  actionType: item.action_type,
  status: item.status,
  createdAt: formatCreatedAt(item.created_at),
});

const submitToForms = async (partNumber: string, supplierCode: string, action: MDSAction, email: string) => {
  const formActionText = action === 'cancel' ? 'Delete' : 'Request';
  const answersArray = [
    {
      questionId: 'r3749d14481644f23a99c5338a500314c',
      answer1: formActionText,
    },
    {
      questionId: 're8bb47fc4eeb42e89c852f1d08316233',
      answer1: partNumber,
    },
    {
      questionId: 'rdbb086f5efb2404fb1b687ba41aaff64',
      answer1: supplierCode,
    },
    {
      questionId: 'rce020f288faf4a7d8851f6f9c1bd6386',
      answer1: email,
    },
  ];

  return fetch(FORMS_SUBMIT_URL, {
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
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('mds_requests')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedRecords = (data ?? []).map(item => formatRecord(item as MDSDbRecord));

    return NextResponse.json({ success: true, records: formattedRecords });
  } catch (error) {
    console.error('Fetch MDS history error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MDSRequestBody;
    const partNumber = typeof body.partNumber === 'string' ? body.partNumber.trim() : '';
    const supplierCode = typeof body.supplierCode === 'string' ? body.supplierCode.trim() : '';
    const action: MDSAction = body.action === 'cancel' ? 'cancel' : 'request';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 });
    }
    if (!partNumber) {
      return NextResponse.json({ success: false, error: 'Missing partNumber' }, { status: 400 });
    }
    if (!supplierCode) {
      return NextResponse.json({ success: false, error: 'Missing supplierCode' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ success: false, error: 'Missing email' }, { status: 400 });
    }
    if (!isVolvoEmail(email)) {
      return NextResponse.json({ success: false, error: 'Email must be a @volvo.com address' }, { status: 400 });
    }

    const { data: duplicateRows, error: duplicateError } = await supabase
      .from('mds_requests')
      .select('id')
      .eq('part_number', partNumber)
      .eq('supplier_code', supplierCode)
      .eq('action_type', action)
      .neq('status', 'Rejected')
      .limit(1);

    if (duplicateError) throw duplicateError;

    if (duplicateRows && duplicateRows.length > 0) {
      return NextResponse.json({
        success: false,
        error: `重复提交：PARMA ${supplierCode} + Material ${partNumber} 已存在相同 ${action === 'cancel' ? 'Cancel' : 'Request'} 操作`,
        duplicatePartNumbers: [partNumber],
      }, { status: 409 });
    }

    const createdAt = new Date().toISOString();
    const payload = {
      part_number: partNumber,
      supplier_code: supplierCode,
      action_type: action,
      status: 'New',
      session_id: sessionId,
      submitter_email: email,
      admin_comment: null,
      batch_id: null,
      batch_size: 1,
      batch_index: 1,
      created_at: createdAt,
    };

    let reactivated = false;
    let savedRecord: MDSDbRecord | null = null;
    const { data: insertedRecord, error: insertError } = await supabase
      .from('mds_requests')
      .insert([payload])
      .select('id, part_number, supplier_code, action_type, status, created_at')
      .single();

    if (insertError?.code === '23505') {
      const { data: rejectedRows, error: rejectedError } = await supabase
        .from('mds_requests')
        .select('id')
        .eq('part_number', partNumber)
        .eq('supplier_code', supplierCode)
        .eq('action_type', action)
        .eq('status', 'Rejected')
        .order('created_at', { ascending: false })
        .limit(1);

      if (rejectedError) throw rejectedError;

      const rejectedId = rejectedRows?.[0]?.id as string | undefined;
      if (!rejectedId) {
        console.error('Supabase write failed:', insertError);
        return NextResponse.json({
          success: false,
          error: '数据库唯一索引仍在拦截这条记录。请确认 Supabase 已应用 allow_resubmit_after_rejected migration，并删除旧的 supplier/material 唯一索引。',
          duplicatePartNumbers: [partNumber],
        }, { status: 409 });
      }

      const { data: updatedRecord, error: updateError } = await supabase
        .from('mds_requests')
        .update(payload)
        .eq('id', rejectedId)
        .select('id, part_number, supplier_code, action_type, status, created_at')
        .single();

      if (updateError) {
        console.error('Supabase reactivation failed:', updateError);
        throw new Error('Database reactivation failed');
      }

      reactivated = true;
      savedRecord = updatedRecord as MDSDbRecord;
    } else if (insertError) {
      console.error('Supabase write failed:', insertError);
      throw new Error('Database write failed');
    } else {
      savedRecord = insertedRecord as MDSDbRecord;
    }

    const response = await submitToForms(partNumber, supplierCode, action, email);
    const record = formatRecord(savedRecord);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Forms submit failed:', errorText);
      return NextResponse.json({
        success: true,
        warning: 'Saved to local but failed to sync to Forms',
        record,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'MDS request saved and synced to Microsoft Forms',
      record,
      reactivated,
    });
  } catch (error) {
    console.error('MDS API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
