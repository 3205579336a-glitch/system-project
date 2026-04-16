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
  thumbnail_url?: string | null;
  tags: string[];
  extracted_links: Array<{ title: string; url: string }>;
  page_screenshots?: string[];
  updated_at: string;
  snapshot_urls?: string[];
  snapshot_count?: number;
  snapshot_status?: string;
  snapshot_strategy?: string;
  snapshot_generated_at?: string;
};

// 🚨 禁用 SSL 验证（仅建议在公司内网/代理环境下使用）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const SYSTEM_PROMPT = `
You are an expert Training Material Content Analyzer. Your task is to analyze the text and extract structured metadata into a strict JSON format.

*** STRICT RULES ***
1. OUTPUT ONLY PURE JSON. NO MARKDOWN (no \`\`\`json).
2. USE CHINESE (Simplified) for description.
3. INFER missing data logically.

*** REQUIRED JSON SCHEMA ***
{
  "id": "learn_xxx",
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

async function uploadSnapshots(snapshotFiles: File[], folderKey: string) {
  const snapshotUrls: string[] = [];
  for (let index = 0; index < snapshotFiles.length; index += 1) {
    const snapshotFile = snapshotFiles[index];
    const extension = snapshotFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const objectPath = `${folderKey}/snapshot_${index + 1}.${extension}`;

    try {
      const { error } = await supabaseAdmin.storage
        .from('thumbnails')
        .upload(objectPath, Buffer.from(await snapshotFile.arrayBuffer()), {
          contentType: snapshotFile.type || 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error(`[Supabase Upload Error] 快照 ${index + 1} 失败:`, error.message);
        continue;
      }
      
      const { data } = supabaseAdmin.storage.from('thumbnails').getPublicUrl(objectPath);
      if (data.publicUrl) snapshotUrls.push(data.publicUrl);
    } catch (err: any) {
      console.error(`[网络/环境错误] 上传快照时崩溃: ${err.message}`);
    }
  }
  return snapshotUrls;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const aiKey = process.env.DASHSCOPE_API_KEY;

    // 基础环境变量检查
    if (!supabaseUrl?.startsWith('http')) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL 缺失或格式错误（必须包含 https://）');
    }
    if (!serviceRoleKey || !aiKey) {
      throw new Error('服务器环境变量未正确配置 (SUPABASE_SERVICE_ROLE_KEY 或 DASHSCOPE_API_KEY)。');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const inputData = formData.get('inputData') as string | null;
    const selectedModel = (formData.get('model') as string) || 'qwen3.6-plus';
    const snapshotStrategy = (formData.get('snapshotStrategy') as string) || 'client-snapshots';
    const snapshotFiles = formData.getAll('screenshots').filter(Boolean) as File[];

    if (!file || !inputData) {
      return NextResponse.json({ success: false, error: '缺失必要字段：file 或 inputData。' }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeFileName = `${timestamp}-${sanitizeFileName(file.name)}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // ==========================================
    // 阶段 1：主文件上传至 Supabase
    // ==========================================
    console.log('[1/4] 正在上传主文件至 Supabase...');
    let materialUrl = '';
    try {
      const uploadResult = await supabaseAdmin.storage.from('materials').upload(safeFileName, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });
      if (uploadResult.error) throw new Error(uploadResult.error.message);
      materialUrl = supabaseAdmin.storage.from('materials').getPublicUrl(safeFileName).data.publicUrl;
    } catch (err: any) {
      throw new Error(`[Supabase 存储连接失败] ${err.message}`);
    }

    // ==========================================
    // 阶段 2：请求阿里云大模型
    // ==========================================
    console.log('[2/4] 正在请求阿里云千问大模型...');
    let aiResponse;
    try {
      aiResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
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
    } catch (err: any) {
      // 这是最容易抛出 fetch failed 的地方（内网/代理/DNS问题）
      throw new Error(`[阿里云大模型请求拦截/超时] 无法连接到 Dashscope API: ${err.message}`);
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`[阿里云大模型报错] 状态码 ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const rawAiContent = aiData.choices?.[0]?.message?.content;
    const cleanJson = String(rawAiContent || '').replace(/```json|```/g, '').trim();
    const resultJson = JSON.parse(cleanJson);
    const generatedId = resultJson.id || `learn_${Math.random().toString(36).slice(2, 8)}`;

    // ==========================================
    // 阶段 3：上传快照
    // ==========================================
    console.log('[3/4] 正在处理快照图片...');
    const snapshotFolder = `${generatedId}-${timestamp}`;
    const snapshotUrls = await uploadSnapshots(snapshotFiles, snapshotFolder);

    // ==========================================
    // 阶段 4：数据入库 Supabase
    // ==========================================
    console.log('[4/4] 正在写入数据库...');
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
      snapshot_urls: snapshotUrls,
      snapshot_count: snapshotUrls.length,
      snapshot_status: snapshotUrls.length > 0 ? 'ready' : 'missing',
      snapshot_strategy: snapshotStrategy,
      snapshot_generated_at: snapshotUrls.length > 0 ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    };

    let savedRecord;
    try {
      const dbResult = await supabaseAdmin.from('learning_contents').upsert(finalRecord, { onConflict: 'id' }).select().maybeSingle();
      if (dbResult.error) {
        // 触发降级机制 (应对缺失字段)
        console.warn('全字段写入失败，尝试降级基础写入:', dbResult.error.message);
        const legacyPayload = {
          id: finalRecord.id, title: finalRecord.title, type: finalRecord.type,
          module: finalRecord.module, role: finalRecord.role, description: finalRecord.description,
          author: finalRecord.author, url: finalRecord.url, tags: finalRecord.tags,
          extracted_links: finalRecord.extracted_links, updated_at: finalRecord.updated_at,
        };
        const legacyResult = await supabaseAdmin.from('learning_contents').upsert(legacyPayload, { onConflict: 'id' }).select().maybeSingle();
        if (legacyResult.error) throw new Error(legacyResult.error.message);
        savedRecord = { ...legacyResult.data, page_screenshots: finalRecord.page_screenshots, thumbnail_url: finalRecord.thumbnail_url };
      } else {
        savedRecord = dbResult.data;
      }
    } catch (err: any) {
      throw new Error(`[Supabase 数据库写入失败] ${err.message}`);
    }

    console.log('✅ 所有流程处理完毕');
    return NextResponse.json({ success: true, data: { ...savedRecord, extractedLinks: savedRecord?.extracted_links ?? [] } });

  } catch (error) {
    const message = error instanceof Error ? error.message : '未知的服务器错误';
    console.error('❌ [analyze-learning ERROR]:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}