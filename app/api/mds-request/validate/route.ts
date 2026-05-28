import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type ValidationRow = {
  partNumber: string;
  supplierCode: string;
};

type ValidationBody = {
  rows?: unknown;
  action?: unknown;
};

const normalizeRows = (rows: unknown): ValidationRow[] => {
  if (!Array.isArray(rows)) return [];

  return rows
    .map(row => {
      if (!row || typeof row !== 'object') return null;
      const candidate = row as { partNumber?: unknown; supplierCode?: unknown };
      const partNumber = typeof candidate.partNumber === 'string' ? candidate.partNumber.trim() : '';
      const supplierCode = typeof candidate.supplierCode === 'string' ? candidate.supplierCode.trim() : '';
      return partNumber && supplierCode ? { partNumber, supplierCode } : null;
    })
    .filter((row): row is ValidationRow => row !== null);
};

const pairKey = (row: ValidationRow) => `${row.supplierCode}::${row.partNumber}`;

const findDuplicatePairs = (rows: ValidationRow[]) => {
  const seen = new Set<string>();
  const duplicates = new Map<string, ValidationRow>();

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
    const body = (await request.json()) as ValidationBody;
    const rows = normalizeRows(body.rows);
    const action = body.action === 'cancel' ? 'cancel' : 'request';

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid PARMA/material rows' }, { status: 400 });
    }

    const duplicateInUpload = findDuplicatePairs(rows);
    const partNumbers = Array.from(new Set(rows.map(row => row.partNumber)));
    const supplierCodes = Array.from(new Set(rows.map(row => row.supplierCode)));

    const { data: existingRows, error } = await supabase
      .from('mds_requests')
      .select('part_number, supplier_code')
      .in('part_number', partNumbers)
      .in('supplier_code', supplierCodes)
      .eq('action_type', action);

    if (error) throw error;

    const requestedKeys = new Set(rows.map(pairKey));
    const duplicateInDatabase = (existingRows ?? [])
      .map(row => ({ partNumber: row.part_number, supplierCode: row.supplier_code }))
      .filter(row => requestedKeys.has(pairKey(row)));

    return NextResponse.json({
      success: true,
      duplicateRows: [
        ...duplicateInUpload.map(row => ({ ...row, source: 'upload' as const })),
        ...duplicateInDatabase.map(row => ({ ...row, source: 'database' as const })),
      ],
    });
  } catch (error) {
    console.error('MDS validation API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
