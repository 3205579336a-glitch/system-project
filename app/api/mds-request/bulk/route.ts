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

type SavedDbRecord = {
  id: string;
  part_number: string;
  supplier_code: string;
  action_type: BulkAction;
  status: 'New' | 'Processing' | 'Done' | 'Rejected';
  created_at: string;
  batch_id: string | null;
};

const FORMS_SUBMIT_URL =
  "https://forms.office.com/formapi/api/f25493ae-1c98-41d7-8a33-0be75f5fe603/users/03e50a34-e0ea-4c54-ad8a-b1f6c26a7cc8/forms('rpNU8pgc10GKMwvnX1_mAzQK5QPq4FRMrYqx9sJqfMhUNzJDODBVREUwOUJSRE9IMkRCMjBBT1VYUS4u')/responses";

const isVolvoEmail = (value: string) => /^[A-Z0-9._%+-]+@volvo\.com$/i.test(value);

const pairKey = (row: BulkInputRow) => `${row.supplierCode}::${row.partNumber}`;

const formatCreatedAt = (value: string) =>
  new Date(value).toLocaleString('zh-CN', { hour12: false }).substring(0, 16).replace(/\//g, '-');

const formatRecord = (item: SavedDbRecord) => ({
  id: item.id,
  partNumber: item.part_number,
  supplierCode: item.supplier_code,
  actionType: item.action_type,
  status: item.status,
  batchId: item.batch_id,
  createdAt: formatCreatedAt(item.created_at),
});

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

const submitBatchToForms = async (rows: BulkInputRow[], action: BulkAction, email: string, createdAt: string) => {
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

  return fetch(FORMS_SUBMIT_URL, {
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
    if (!isVolvoEmail(email)) {
      return NextResponse.json({ success: false, error: 'Email must be a @volvo.com address' }, { status: 400 });
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
    const requestedKeys = new Set(rows.map(pairKey));

    const { data: existingRows, error: duplicateError } = await supabase
      .from('mds_requests')
      .select('part_number, supplier_code')
      .in('part_number', partNumbers)
      .in('supplier_code', supplierCodes)
      .eq('action_type', action)
      .neq('status', 'Rejected');

    if (duplicateError) throw duplicateError;

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
    const preparedRows = rows.map((row, index) => ({
      ...row,
      batchIndex: index + 1,
      rejectedId: undefined as string | undefined,
    }));

    const toDbPayload = (row: BulkInputRow & { batchIndex: number }) => ({
      part_number: row.partNumber,
      supplier_code: row.supplierCode,
      action_type: action,
      status: 'New',
      session_id: sessionId,
      submitter_email: email,
      admin_comment: null,
      batch_id: batchId,
      batch_size: rows.length,
      batch_index: row.batchIndex,
      created_at: createdAt,
    });

    const savedRecords: SavedDbRecord[] = [];
    let reactivatedCount = 0;

    const { data: insertedRecords, error: insertError } = await supabase
      .from('mds_requests')
      .insert(preparedRows.map(toDbPayload))
      .select('id, part_number, supplier_code, action_type, status, created_at, batch_id');

    if (insertError?.code === '23505') {
      const { data: rejectedRows, error: rejectedError } = await supabase
        .from('mds_requests')
        .select('id, part_number, supplier_code')
        .in('part_number', partNumbers)
        .in('supplier_code', supplierCodes)
        .eq('action_type', action)
        .eq('status', 'Rejected')
        .order('created_at', { ascending: false });

      if (rejectedError) throw rejectedError;

      const reusableRejectedIds = new Map<string, string>();
      (rejectedRows ?? []).forEach(row => {
        const key = pairKey({ partNumber: row.part_number, supplierCode: row.supplier_code });
        if (requestedKeys.has(key) && !reusableRejectedIds.has(key)) {
          reusableRejectedIds.set(key, row.id);
        }
      });

      const fallbackRows = preparedRows.map(row => ({
        ...row,
        rejectedId: reusableRejectedIds.get(pairKey(row)),
      }));
      const insertPayload = fallbackRows
        .filter(row => !row.rejectedId)
        .map(toDbPayload);

      if (insertPayload.length > 0) {
        const { data, error: dbError } = await supabase
          .from('mds_requests')
          .insert(insertPayload)
          .select('id, part_number, supplier_code, action_type, status, created_at, batch_id');

        if (dbError) {
          console.error('Supabase bulk fallback insert failed:', dbError);
          return NextResponse.json({
            success: false,
            error: '数据库唯一索引仍在拦截批量记录。请确认 Supabase 已应用 allow_resubmit_after_rejected migration，并删除旧的 supplier/material 唯一索引。',
          }, { status: 409 });
        }

        savedRecords.push(...((data ?? []) as SavedDbRecord[]));
      }

      const rowsToReactivate = fallbackRows.filter(row => row.rejectedId);
      if (rowsToReactivate.length > 0) {
        const updateResults = await Promise.all(rowsToReactivate.map(row =>
          supabase
            .from('mds_requests')
            .update(toDbPayload(row))
            .eq('id', row.rejectedId)
            .select('id, part_number, supplier_code, action_type, status, created_at, batch_id')
            .single()
        ));

        const updateError = updateResults.find(result => result.error)?.error;
        if (updateError) {
          console.error('Supabase bulk reactivation failed:', updateError);
          throw new Error('Database reactivation failed');
        }

        savedRecords.push(...updateResults.map(result => result.data as SavedDbRecord));
      }

      reactivatedCount = rowsToReactivate.length;
    } else if (insertError) {
      console.error('Supabase bulk insert failed:', insertError);
      throw new Error('Database insert failed');
    } else {
      savedRecords.push(...((insertedRecords ?? []) as SavedDbRecord[]));
    }

    const savedRecordByKey = new Map(savedRecords.map(record => [
      pairKey({ partNumber: record.part_number, supplierCode: record.supplier_code }),
      record,
    ]));
    const records = rows
      .map(row => savedRecordByKey.get(pairKey(row)))
      .filter((record): record is SavedDbRecord => Boolean(record))
      .map(formatRecord);

    const response = await submitBatchToForms(rows, action, email, createdAt);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bulk Forms submit failed:', errorText);
      return NextResponse.json({
        success: true,
        warning: 'Saved to local but failed to sync batch to Forms',
        batchId,
        count: rows.length,
        records,
        reactivatedCount,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Batch saved and synced to Microsoft Forms',
      batchId,
      count: rows.length,
      records,
      reactivatedCount,
    });
  } catch (error) {
    console.error('MDS bulk API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
