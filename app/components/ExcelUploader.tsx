'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, Loader2, CheckCircle } from 'lucide-react';

// 🌟 修复 1：定义 Props 接口，告诉 TS 我们接受一个可选的 onUploadSuccess 函数
interface ExcelUploaderProps {
  onUploadSuccess?: () => void;
}
// 🌟 修复 2：在组件的参数里接收解构出的 onUploadSuccess
export default function ExcelUploader({ onUploadSuccess }: ExcelUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMsg('正在读取 Excel 文件...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet);

      const totalRecords = rawJson.length;
      if (totalRecords === 0) throw new Error('Excel 文件是空的！');

      const CHUNK_SIZE = 20; 
      const START_INDEX = 0; // 或者你之前设置的 79
      let successCount = 0;

      for (let i = START_INDEX; i < totalRecords; i += CHUNK_SIZE) {
        const batch = rawJson.slice(i, i + CHUNK_SIZE);
        const currentEnd = Math.min(i + CHUNK_SIZE, totalRecords);
        
        setStatusMsg(`正在请求 AI 处理进度：${i + 1} ~ ${currentEnd} / 共 ${totalRecords} 条...`);
        
        const aiResponse = await fetch('/api/ai-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawData: batch })
        });
        
        const aiResult = await aiResponse.json();
        if (!aiResult.success) throw new Error(`AI 处理失败: ${aiResult.error}`);

        setStatusMsg(`正在写入数据库：${i + 1} ~ ${currentEnd} / 共 ${totalRecords} 条...`);

        const dbResponse = await fetch('/api/system-cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiResult.data)
        });

        const dbResult = await dbResponse.json();
        if (!dbResult.success) throw new Error(`数据库写入失败: ${dbResult.error}`);

        successCount += aiResult.data.length;
      }

      setStatusMsg(`🎉 全部搞定！成功清洗并导入了 ${successCount} 条数据。`);
      
      // 🌟 修复 3：在所有数据都成功导入后，调用这个函数，通知父组件去刷新数据库！
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      
    } catch (error: any) {
      console.error(error);
      setStatusMsg(`导入意外中断: ${error.message}`);
    } finally {
      setIsProcessing(false);
      e.target.value = ''; 
    }
  };

  return (
    <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
      <h3 className="text-lg font-bold text-slate-800 mb-2">批量导入排查库</h3>
      <p className="text-sm text-slate-500 mb-6">上传你的系统跟踪 Excel，AI 将分批自动匹配并提取解决方案。</p>
      
      <div className="relative inline-block">
        <input 
          type="file" 
          accept=".xlsx, .xls, .csv" 
          onChange={handleFileUpload}
          disabled={isProcessing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <button 
          disabled={isProcessing}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            isProcessing 
              ? 'bg-blue-50 text-blue-400' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
          }`}
        >
          {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
          {isProcessing ? '流水线处理中...' : '选择 Excel 文件'}
        </button>
      </div>

      {/* 状态展示，如果正在处理，文字可以加点呼吸动画 */}
      {statusMsg && (
        <div className={`mt-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
          statusMsg.includes('中断') ? 'text-red-500' : 
          statusMsg.includes('搞定') ? 'text-green-600' : 'text-blue-600 animate-pulse'
        }`}>
          {statusMsg.includes('搞定') && <CheckCircle className="w-4 h-4 text-green-500" />}
          {statusMsg}
        </div>
      )}
    </div>
  );
}