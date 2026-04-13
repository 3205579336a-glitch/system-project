import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type LearningContentRecord = {
  id: string;
  title: string;
  type: string;
  module: string;
  role: string;
  description: string;
  author: string;
  url: string;
  thumbnail_url: string | null;
  tags: string[];
  extracted_links: Array<{ title: string; url: string }>;
  page_screenshots: string[];
  updated_at: string;
  snapshot_urls?: string[];
  snapshot_count?: number;
  snapshot_status?: string;
  snapshot_strategy?: string;
  snapshot_generated_at?: string;
};

const SYSTEM_PROMPT = `
You are an expert Training Material Content Analyzer. Your task is to analyze the text and extract structured metadata into a strict JSON format.

*** STRICT RULES ***
1. OUTPUT ONLY PURE JSON. NO MARKDOWN (no \`\`\`json).
2. USE CHINESE (Simplified) for description.
3. INFER missing data logically.

*** REQUIRED JSON SCHEMA ***
{
  "id": "learn_xxx (Generate a unique 6-8 character alphanumeric string if not clear)",
  "type": "document/presentation/video",
  "title": "Concise title",
  "module": "System Improvement/Logistics/Quality/General",
  "role": "Key User/Supplier/Admin/All Users",
  "description": "2-3 sentences summary in Chinese",
  "author": "Extract or 'IT Support Team'",
  "tags": ["tag1", "tag2", "tag3"],
  "extractedLinks": [
    {"title": "Link Title", "url": "URL"}
  ]
}
`;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function sanitizeFileName(name: string) {
  return name.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, '_');
}

function buildSnapshotPayload(
  baseRecord: LearningContentRecord,
  snapshotUrls: string[],
  snapshotStrategy: string
): LearningContentRecord {
  const now = new Date().toISOString();

  return {
    ...baseRecord,
    snapshot_urls: snapshotUrls,
    snapshot_count: snapshotUrls.length,
    snapshot_status: snapshotUrls.length > 0 ? 'ready' : 'missing',
    snapshot_strategy: snapshotStrategy,
    snapshot_generated_at: snapshotUrls.length > 0 ? now : undefined,
  };
}

async function uploadSnapshots(snapshotFiles: File[], folderKey: string) {
  const snapshotUrls: string[] = [];

  for (let index = 0; index < snapshotFiles.length; index += 1) {
    const snapshotFile = snapshotFiles[index];
    const extension = snapshotFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const objectPath = `${folderKey}/snapshot_${index + 1}.${extension}`;

    const { error } = await supabaseAdmin.storage
      .from('thumbnails')
      .upload(objectPath, Buffer.from(await snapshotFile.arrayBuffer()), {
        contentType: snapshotFile.type || 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error(`[snapshot-upload] failed at index ${index + 1}:`, error.message);
      continue;
    }

    const { data } = supabaseAdmin.storage.from('thumbnails').getPublicUrl(objectPath);
    if (data.publicUrl) {
      snapshotUrls.push(data.publicUrl);
    }
  }

  return snapshotUrls;
}

async function saveLearningContent(record: LearningContentRecord) {
  const extendedPayload = buildSnapshotPayload(
    record,
    record.page_screenshots,
    record.snapshot_strategy || 'client-snapshots'
  );

  const extendedResult = await supabaseAdmin
    .from('learning_contents')
    .upsert(extendedPayload, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (!extendedResult.error) {
    return extendedResult.data;
  }

  const message = extendedResult.error.message || '';
  const shouldFallback =
    message.includes('snapshot_') ||
    message.includes('column') ||
    message.includes('schema cache');

  if (!shouldFallback) {
    throw extendedResult.error;
  }

  const legacyPayload: LearningContentRecord = {
    id: record.id,
    title: record.title,
    type: record.type,
    module: record.module,
    role: record.role,
    description: record.description,
    author: record.author,
    url: record.url,
    thumbnail_url: record.thumbnail_url,
    tags: record.tags,
    extracted_links: record.extracted_links,
    page_screenshots: record.page_screenshots,
    updated_at: record.updated_at,
  };

  const legacyResult = await supabaseAdmin
    .from('learning_contents')
    .upsert(legacyPayload, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return legacyResult.data;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const aiKey = process.env.DASHSCOPE_API_KEY;

    if (!supabaseUrl || !serviceRoleKey || !aiKey) {
      return NextResponse.json(
        { success: false, error: 'Server environment variables are not configured correctly.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const inputData = formData.get('inputData') as string | null;
    const selectedModel = (formData.get('model') as string) || 'qwen-plus';
    const snapshotStrategy = (formData.get('snapshotStrategy') as string) || 'client-snapshots';
    const snapshotFiles = formData.getAll('screenshots').filter(Boolean) as File[];

    if (!file || !inputData) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: file and inputData.' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const safeFileName = `${timestamp}-${sanitizeFileName(file.name)}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await supabaseAdmin.storage.from('materials').upload(safeFileName, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

    if (uploadResult.error) {
      throw new Error(`Main file upload failed: ${uploadResult.error.message}`);
    }

    const materialUrl = supabaseAdmin.storage.from('materials').getPublicUrl(safeFileName).data.publicUrl;

    const aiResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze the following content:\n${inputData.slice(0, 8000)}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('AI service request failed.');
    }

    const aiData = await aiResponse.json();
    const rawAiContent = aiData.choices?.[0]?.message?.content;
    const cleanJson = String(rawAiContent || '').replace(/```json|```/g, '').trim();
    const resultJson = JSON.parse(cleanJson);
    const generatedId = resultJson.id || `learn_${Math.random().toString(36).slice(2, 8)}`;

    const snapshotFolder = `${generatedId}-${timestamp}`;
    const snapshotUrls = await uploadSnapshots(snapshotFiles, snapshotFolder);

    const finalRecord: LearningContentRecord = {
      id: generatedId,
      title: resultJson.title || file.name,
      type: resultJson.type || 'document',
      module: resultJson.module || 'General',
      role: resultJson.role || 'All Users',
      description: resultJson.description || '',
      author: resultJson.author || 'IT Support Team',
      url: materialUrl,
      thumbnail_url: snapshotUrls[0] ?? null,
      tags: Array.isArray(resultJson.tags) ? resultJson.tags : [],
      extracted_links: Array.isArray(resultJson.extractedLinks) ? resultJson.extractedLinks : [],
      page_screenshots: snapshotUrls,
      snapshot_strategy: snapshotStrategy,
      updated_at: new Date().toISOString(),
    };

    const savedRecord = await saveLearningContent(finalRecord);

    return NextResponse.json({
      success: true,
      data: {
        ...savedRecord,
        extractedLinks: savedRecord?.extracted_links ?? [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    console.error('[analyze-learning]', message);

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
