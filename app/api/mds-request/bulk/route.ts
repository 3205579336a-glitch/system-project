import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type BulkAction = 'request' | 'cancel';

type BulkRequestBody = {
  rows?: unknown;
  partNumbers?: unknown;
  supplierCode?: unknown;
  action?: unknown;
  sessionId?: unknown;
  email?: unknown;
};

type BulkInputRow = {
  partNumber: string;
  supplierCode: string;
};

const FORMS_SUBMIT_URL =
  "https://forms.office.com/formapi/api/f25493ae-1c98-41d7-8a33-0be75f5fe603/users/03e50a34-e0ea-4c54-ad8a-b1f6c26a7cc8/forms('rpNU8pgc10GKMwvnX1_mAzQK5QPq4FRMrYqx9sJqfMhUNzJDODBVREUwOUJSRE9IMkRCMjBBT1VYUS4u')/responses";

const normalizeRows = (body: BulkRequestBody): BulkInputRow[] => {
  if (Array.isArray(body.rows)) {
    return body.rows
      .map(row => {
        if (!row || typeof row !== 'object') return null;
        const candidate = row as { partNumber?: unknown; supplierCode?: unknown };
        const partNumber = typeof candidate.partNumber === 'string' ? candidate.partNumber.trim() : '';
        const supplierCode = typeof candidate.supplierCode === 'string' ? candidate.supplierCode.trim() : '';
        return partNumber && supplierCode ? { partNumber, supplierCode } : null;
      })
      .filter((row): row is BulkInputRow => row !== null);
  }

  const supplierCode = typeof body.supplierCode === 'string' ? body.supplierCode.trim() : '';
  if (!supplierCode || !Array.isArray(body.partNumbers) || !body.partNumbers.every(value => typeof value === 'string')) {
    return [];
  }

  return body.partNumbers
    .map(value => value.trim())
    .filter(Boolean)
    .map(partNumber => ({ partNumber, supplierCode }));
};

const pairKey = (row: BulkInputRow) => `${row.supplierCode}::${row.partNumber}`;

const findDuplicatePairs = (rows: BulkInputRow[]) => {
  const seen = new Set<string>();
  const duplicates = new Map<string, BulkInputRow>();

  rows.forEach(row => {
    const key = pairKey(row);
    if (seen.has(key)) {
      duplicates.set(key, row);
    } else {
      seen.add(key);
    }
  });

  return Array.from(duplicates.values());
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BulkRequestBody;
    const rows = normalizeRows(body);
    const action: BulkAction = body.action === 'cancel' ? 'cancel' : 'request';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ success: false, error: 'Missing email' }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid PARMA/material rows' }, { status: 400 });
    }

    const duplicateInBatch = findDuplicatePairs(rows);
    if (duplicateInBatch.length > 0) {
      return NextResponse.json({
        success: false,
        error: `批量文件内存在重复 PARMA + Material：${duplicateInBatch.map(row => `${row.supplierCode}/${row.partNumber}`).join(', ')}`,
        duplicateRows: duplicateInBatch,
        duplicatePartNumbers: duplicateInBatch.map(row => row.partNumber),
      }, { status: 409 });
    }

    const partNumbers = Array.from(new Set(rows.map(row => row.partNumber)));
    const supplierCodes = Array.from(new Set(rows.map(row => row.supplierCode)));

    const { data: existingRows, error: duplicateError } = await supabase
      .from('mds_requests')
      .select('part_number, supplier_code')
      .in('part_number', partNumbers)
      .in('supplier_code', supplierCodes)
      .eq('action_type', action);

    if (duplicateError) throw duplicateError;

    const requestedKeys = new Set(rows.map(pairKey));
    const duplicateRows = (existingRows ?? [])
      .map(row => ({ partNumber: row.part_number, supplierCode: row.supplier_code }))
      .filter(row => requestedKeys.has(pairKey(row)));

    if (duplicateRows.length > 0) {
      return NextResponse.json({
        success: false,
        error: `数据库中已有 ${duplicateRows.length} 组相同 ${action === 'cancel' ? 'Cancel' : 'Request'} 的 PARMA + Material`,
        duplicateRows,
        duplicatePartNumbers: duplicateRows.map(row => row.partNumber),
      }, { status: 409 });
    }

    const batchId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const dbRows = rows.map((row, index) => ({
      part_number: row.partNumber,
      supplier_code: row.supplierCode,
      action_type: action,
      status: 'New',
      session_id: sessionId,
      submitter_email: email,
      batch_id: batchId,
      batch_size: rows.length,
      batch_index: index + 1,
    }));

    const { data, error: dbError } = await supabase
      .from('mds_requests')
      .insert(dbRows)
      .select('id, part_number, supplier_code, status, created_at, batch_id');

    if (dbError) {
      console.error('Supabase bulk insert failed:', dbError);
      if (dbError.code === '23505') {
        return NextResponse.json({
          success: false,
          error: '数据库唯一索引仍在拦截重复 PARMA + Material。请删除旧索引并创建包含 action_type 的唯一索引。',
        }, { status: 409 });
      }
      throw new Error('Database insert failed');
    }

    const formActionText = action === 'cancel' ? 'Delete' : 'Request';
    const materialLines = rows.map(row => row.partNumber);
    const supplierLines = rows.map(row => row.supplierCode);
    const answersArray = [
      {
        questionId: 'r3749d14481644f23a99c5338a500314c',
        answer1: formActionText,
      },
      {
        questionId: 're8bb47fc4eeb42e89c852f1d08316233',
        answer1: materialLines.join('\n'),
      },
      {
        questionId: 'rdbb086f5efb2404fb1b687ba41aaff64',
        answer1: supplierLines.join('\n'),
      },
      {
        questionId: 'rce020f288faf4a7d8851f6f9c1bd6386',
        answer1: email,
      },
    ];

    const response = await fetch(FORMS_SUBMIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://forms.office.com',
        Referer: 'https://forms.office.com/',
      },
      body: JSON.stringify({
        startDate: createdAt,
        submitDate: new Date().toISOString(),
        answers: JSON.stringify(answersArray),
      }),
    });

    const records = (data ?? []).map(item => ({
      id: item.id,
      partNumber: item.part_number,
      supplierCode: item.supplier_code,
      status: item.status,
      batchId: item.batch_id,
      createdAt: new Date(item.created_at).toLocaleString('zh-CN', { hour12: false }).substring(0, 16).replace(/\//g, '-'),
    }));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bulk Forms submit failed:', errorText);
      return NextResponse.json({
        success: true,
        warning: 'Saved to local but failed to sync batch to Forms',
        batchId,
        count: rows.length,
        records,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Batch saved and synced to Microsoft Forms',
      batchId,
      count: rows.length,
      records,
    });
  } catch (error) {
    console.error('MDS bulk API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
