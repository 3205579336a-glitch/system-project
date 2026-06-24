import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type BulkAction = 'request' | 'cancel';
type RequestStatus = 'New' | 'Processing' | 'Done' | 'Rejected';

type BulkRequestBody = {
  rows?: unknown;
  partNumbers?: unknown;
  supplierCode?: unknown;
  action?: unknown;
  sessionId?: unknown;
  email?: unknown;
  language?: unknown;
};

type BulkInputRow = {
  partNumber: string;
  supplierCode: string;
};

type PreparedBulkRow = BulkInputRow & {
  batchIndex: number;
  rejectedId?: string;
};

type SavedDbRecord = {
  id: string;
  part_number: string;
  supplier_code: string;
  action_type: BulkAction;
  status: RequestStatus;
  created_at: string;
  batch_id: string | null;
};

const FORMS_SUBMIT_URL =
  "https://forms.office.com/formapi/api/f25493ae-1c98-41d7-8a33-0be75f5fe603/users/03e50a34-e0ea-4c54-ad8a-b1f6c26a7cc8/forms('rpNU8pgc10GKMwvnX1_mAzQK5QPq4FRMrYqx9sJqfMhUNzJDODBVREUwOUJSRE9IMkRCMjBBT1VYUS4u')/responses";

const isVolvoEmail = (value: string) => /^[A-Z0-9._%+-]+@volvo\.com$/i.test(value);
const pairKey = (row: BulkInputRow) => `${row.supplierCode}::${row.partNumber}`;

const messages = {
  zh: {
    missingSession: '缺少会话信息，请刷新页面后重试。',
    missingEmail: '请填写邮箱地址。',
    invalidEmail: '请使用 @volvo.com 邮箱提交。',
    noRows: '没有可提交的有效 PARMA / Material 数据。',
    duplicateUpload: (pairs: string) => `批量文件内存在重复的 PARMA + Material：${pairs}`,
    duplicateDatabase: (count: number, action: BulkAction) =>
      `数据库中已有 ${count} 组相同 ${action === 'cancel' ? 'Cancel' : 'Request'} 的 PARMA + Material。`,
    duplicateActive: '数据库中已存在相同 PARMA + Material 的未完成操作。',
    savedButFormsFailed: '批量请求已保存，但未能同步至邮件通知流程。',
    saved: '批量请求已保存并同步至邮件通知流程。',
    internal: '系统暂时无法处理批量请求，请稍后重试。',
  },
  en: {
    missingSession: 'Session information is missing. Please refresh the page and try again.',
    missingEmail: 'Please enter your email address.',
    invalidEmail: 'Please submit with a @volvo.com email address.',
    noRows: 'No valid PARMA / Material rows are available to submit.',
    duplicateUpload: (pairs: string) => `The batch file contains duplicate PARMA + Material pairs: ${pairs}`,
    duplicateDatabase: (count: number, action: BulkAction) =>
      `${count} PARMA + Material pair(s) already have the same ${action === 'cancel' ? 'Cancel' : 'Request'} operation in the database.`,
    duplicateActive: 'The database already contains the same unfinished PARMA + Material operation.',
    savedButFormsFailed: 'The batch request was saved, but the email notification flow could not be triggered.',
    saved: 'The batch request was saved and synced to the email notification flow.',
    internal: 'The system could not process the batch request. Please try again later.',
  },
} as const;

const getLanguage = (value: unknown) => value === 'en' ? 'en' : 'zh';

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
  let responseLanguage: keyof typeof messages = 'zh';
  try {
    const body = (await request.json()) as BulkRequestBody;
    const rows = normalizeRows(body);
    const action: BulkAction = body.action === 'cancel' ? 'cancel' : 'request';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const language = getLanguage(body.language);
    responseLanguage = language;
    const t = messages[language];

    if (!sessionId) {
      return NextResponse.json({ success: false, error: t.missingSession }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ success: false, error: t.missingEmail }, { status: 400 });
    }
    if (!isVolvoEmail(email)) {
      return NextResponse.json({ success: false, error: t.invalidEmail }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: t.noRows }, { status: 400 });
    }

    const duplicateInBatch = findDuplicatePairs(rows);
    if (duplicateInBatch.length > 0) {
      const duplicatePairs = duplicateInBatch.map(row => `${row.supplierCode}/${row.partNumber}`).join(', ');
      return NextResponse.json({
        success: false,
        error: t.duplicateUpload(duplicatePairs),
        duplicateRows: duplicateInBatch,
        duplicatePartNumbers: duplicateInBatch.map(row => row.partNumber),
      }, { status: 409 });
    }

    const partNumbers = Array.from(new Set(rows.map(row => row.partNumber)));
    const supplierCodes = Array.from(new Set(rows.map(row => row.supplierCode)));
    const requestedKeys = new Set(rows.map(pairKey));

    const { data: activeRows, error: activeLookupError } = await supabase
      .from('mds_requests')
      .select('part_number, supplier_code')
      .in('part_number', partNumbers)
      .in('supplier_code', supplierCodes)
      .eq('action_type', action)
      .neq('status', 'Rejected');

    if (activeLookupError) throw activeLookupError;

    const duplicateRows = (activeRows ?? [])
      .map(row => ({ partNumber: row.part_number, supplierCode: row.supplier_code }))
      .filter(row => requestedKeys.has(pairKey(row)));

    if (duplicateRows.length > 0) {
      return NextResponse.json({
        success: false,
        error: t.duplicateDatabase(duplicateRows.length, action),
        duplicateRows,
        duplicatePartNumbers: duplicateRows.map(row => row.partNumber),
      }, { status: 409 });
    }

    const { data: rejectedRows, error: rejectedLookupError } = await supabase
      .from('mds_requests')
      .select('id, part_number, supplier_code')
      .in('part_number', partNumbers)
      .in('supplier_code', supplierCodes)
      .eq('action_type', action)
      .eq('status', 'Rejected')
      .order('created_at', { ascending: false });

    if (rejectedLookupError) throw rejectedLookupError;

    const reusableRejectedIds = new Map<string, string>();
    (rejectedRows ?? []).forEach(row => {
      const key = pairKey({ partNumber: row.part_number, supplierCode: row.supplier_code });
      if (requestedKeys.has(key) && !reusableRejectedIds.has(key)) {
        reusableRejectedIds.set(key, row.id);
      }
    });

    const batchId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const preparedRows: PreparedBulkRow[] = rows.map((row, index) => ({
      ...row,
      batchIndex: index + 1,
      rejectedId: reusableRejectedIds.get(pairKey(row)),
    }));

    const toDbPayload = (row: PreparedBulkRow) => ({
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
    const rowsToInsert = preparedRows.filter(row => !row.rejectedId);
    const rowsToReactivate = preparedRows.filter(row => row.rejectedId);

    if (rowsToInsert.length > 0) {
      const { data, error: insertError } = await supabase
        .from('mds_requests')
        .insert(rowsToInsert.map(toDbPayload))
        .select('id, part_number, supplier_code, action_type, status, created_at, batch_id');

      if (insertError?.code === '23505') {
        console.error('Supabase bulk unique constraint blocked insert:', insertError);
        return NextResponse.json({
          success: false,
          error: t.duplicateActive,
        }, { status: 409 });
      }
      if (insertError) {
        console.error('Supabase bulk insert failed:', insertError);
        throw new Error('Database insert failed');
      }

      savedRecords.push(...((data ?? []) as SavedDbRecord[]));
    }

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
        warning: t.savedButFormsFailed,
        batchId,
        count: rows.length,
        records,
        reactivatedCount: rowsToReactivate.length,
      });
    }

    return NextResponse.json({
      success: true,
      message: t.saved,
      batchId,
      count: rows.length,
      records,
      reactivatedCount: rowsToReactivate.length,
    });
  } catch (error) {
    console.error('MDS bulk API error:', error);
    return NextResponse.json({ success: false, error: messages[responseLanguage].internal }, { status: 500 });
  }
}
