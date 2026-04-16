"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UploadCloud, BrainCircuit, Database, FileJson, 
  CheckCircle2, Loader2, Link as LinkIcon, FileText, 
  AlertCircle, RefreshCw, Layers, Trash2, Play, Gauge,
  ChevronDown, Zap, Sparkles, Cpu, XCircle, Search, LucideIcon,
  Image as ImageIcon, FileType, Check, Terminal, ExternalLink, Info
} from 'lucide-react';

// --- 类型定义 ---
interface ParsedResult {
  id: string;
  title: string;
  type: string;
  module: string;
  role: string;
  description: string;
  author: string;
  url: string;
  tags: string[];
  extractedLinks?: Array<{ title: string; url: string }>;
  page_screenshots?: string[];
  snapshot_count?: number;
  snapshot_status?: string;
  snapshot_strategy?: string;
}

interface FileItem {
  id: string;
  file: File;
  status: 'pending' | 'extracting' | 'capturing' | 'analyzing' | 'success' | 'error';
  result?: ParsedResult;
  errorMsg?: string;
  retryCount: number;
  skipVisual?: boolean;
}

interface ModelOption {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  color: string;
}

const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'qwen3.5-plus', name: '极速模式', desc: '处理最快，适合 200+ 批量', icon: Zap, color: 'text-yellow-500' },
  { id: 'qwen3.6-plus', name: '标准模式', desc: '能力均衡，推荐使用', icon: Cpu, color: 'text-blue-500' },
  { id: 'qwen3-max-2026-01-23', name: '最强模式', desc: '逻辑最强，适合复杂PPT', icon: Sparkles, color: 'text-purple-500' },
];

export default function AnalysisPage() {
  const [filesQueue, setFilesQueue] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [libsReady, setLibsReady] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<ModelOption>(AVAILABLE_MODELS[0]);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const supabaseRef = useRef<any>(null);
  const CONCURRENCY_LIMIT = 5; 
  const MAX_RETRIES = 1;

  // --- 1. 动态加载库与 Worker 初始化 ---
  useEffect(() => {
    const loadScripts = async () => {
      const scripts = [
        { id: 'supabase-js', src: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" },
        { id: 'pdfjs', src: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" },
        { id: 'mammoth', src: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js" },
        { id: 'jszip', src: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" }
      ];
      try {
        for (const s of scripts) {
          if (!document.getElementById(s.id)) {
            await new Promise((resolve, reject) => {
              const script = document.createElement("script");
              script.id = s.id; script.src = s.src; script.async = true;
              script.onload = resolve; script.onerror = reject;
              document.head.appendChild(script);
            });
          }
        }
        const win = window as any;
        if (win.pdfjsLib) {
          win.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        }
        setLibsReady(true);
      } catch (err) { console.error("库加载失败", err); }
    };
    loadScripts();
  }, []);

  // --- 2A. 视觉捕捉逻辑：PDF/文档快照 ---
  const capturePdfPages = async (fileData: File | Blob): Promise<Blob[]> => {
    const blobs: Blob[] = [];
    try {
      const win = window as any;
      const arrayBuffer = await fileData.arrayBuffer();
      const pdf = await win.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numToCapture = Math.min(pdf.numPages, 6); // 截取前6页作为快照
      
      for (let i = 1; i <= numToCapture; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8);
        });
        blobs.push(blob);
        canvas.width = 0; canvas.height = 0;
      }
    } catch (err) { console.error("PDF快照生成失败:", err); }
    return blobs;
  };

  // --- 2B. 视觉捕捉逻辑：视频截帧 ---
  const captureVideoFrames = async (file: File): Promise<Blob[]> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = async () => {
        const blobs: Blob[] = [];
        const duration = video.duration;
        // 截取视频的 25%, 50%, 75% 三个时间点作为快照
        const timestamps = [duration * 0.25, duration * 0.5, duration * 0.75].filter(t => !isNaN(t));

        for (const time of timestamps) {
          video.currentTime = time;
          await new Promise((res) => { video.onseeked = () => res(null); });

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

          const blob = await new Promise<Blob>((res) => {
            canvas.toBlob((b) => res(b!), 'image/jpeg', 0.8);
          });
          blobs.push(blob);
        }
        URL.revokeObjectURL(video.src);
        resolve(blobs);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve([]);
      };
    });
  };

  // --- 2C. 视觉捕捉逻辑：纯前端 Office 媒体提取 ---
  const extractOfficeMedia = async (file: File): Promise<Blob[]> => {
    const blobs: Blob[] = [];
    try {
      const win = window as any;
      const zip = await win.JSZip.loadAsync(await file.arrayBuffer());
      
      // 寻找 word/media 或 ppt/media 文件夹下的原生图片
      const imagePaths = Object.keys(zip.files).filter(name => 
        name.match(/(word|ppt)\/media\/.*\.(png|jpe?g|gif|webp)/i)
      );

      // 提取最多前 6 张媒体图片作为视觉参考
      const numToCapture = Math.min(imagePaths.length, 6);
      for (let i = 0; i < numToCapture; i++) {
        const blob = await zip.file(imagePaths[i])?.async('blob');
        if (blob) blobs.push(blob);
      }
    } catch (err) {
      console.warn("Office 媒体提取失败:", err);
    }
    return blobs;
  };

  // --- 3. 文本提取逻辑 ---
  const extractText = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    // 处理音视频及图片，防乱码
    if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '')) {
      return `[视频材料] 文件名: ${file.name}\n请根据该视频文件名，提取其可能对应的模块、角色及简介。`;
    }
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
      return `[图片材料] 文件名: ${file.name}\n请根据该图片文件名提取信息。`;
    }

    const win = window as any;
    if (ext === 'pdf') {
      const pdf = await win.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text;
    }
    if (ext === 'docx') return (await win.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    if (ext === 'pptx') {
      const zip = await win.JSZip.loadAsync(await file.arrayBuffer());
      const slides = Object.keys(zip.files).filter(n => n.startsWith('ppt/slides/slide')).sort();
      let text = '';
      for (const s of slides) {
        const content = await zip.file(s)?.async('string');
        const matches = content?.match(/<a:t>(.*?)<\/a:t>/g);
        if (matches) text += matches.map((m: string) => m.replace(/<\/?a:t>/g, '')).join(' ') + '\n';
      }
      return text;
    }
    return await file.text();
  };

  // --- 4. 处理流程调度 ---
  const startBatchProcess = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const pool = [...filesQueue.filter(f => f.status !== 'success')];
    const runWorker = async () => {
      while (pool.length > 0) {
        const item = pool.shift();
        if (!item) break;
        await processSingleFile(item);
      }
    };
    await Promise.all(Array(Math.min(CONCURRENCY_LIMIT, pool.length)).fill(null).map(runWorker));
    setIsProcessing(false);
  };

  const processSingleFile = async (item: FileItem) => {
    try {
      updateItemStatus(item.id, 'extracting');
      const text = await extractText(item.file);
      
      const ext = item.file.name.split('.').pop()?.toLowerCase();
      let screenshotBlobs: Blob[] = [];
      let skippedVisual = false;

      updateItemStatus(item.id, 'capturing');

      // 阶段 2：纯前端视觉特征提取路由
      if (['mp4', 'mov', 'webm', 'avi'].includes(ext || '')) {
        screenshotBlobs = await captureVideoFrames(item.file);
      } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
        screenshotBlobs = [item.file];
      } else if (ext === 'pdf') {
        screenshotBlobs = await capturePdfPages(item.file);
      } else if (ext === 'docx' || ext === 'pptx') {
        // 直接从 ZIP 包结构中无损提取插入的原生图像
        screenshotBlobs = await extractOfficeMedia(item.file);
        if (screenshotBlobs.length === 0) {
          skippedVisual = true; // 文档内纯文字，无配图可提取
        }
      }

      // 阶段 3：AI 分析与入库
      updateItemStatus(item.id, 'analyzing');
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('inputData', text);
      formData.append('model', currentModel.id);
      
      screenshotBlobs.forEach((blob, i) => {
        formData.append('screenshots', blob, `snap_${i+1}.jpg`);
      });

      const res = await fetch('/api/ai/analyze-learning', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setFilesQueue(q => q.map(f => f.id === item.id ? { 
        ...f, status: 'success', result: data.data, skipVisual: skippedVisual 
      } : f));
      setSelectedFileId(prev => prev || item.id);

    } catch (err: any) {
      if (item.retryCount < MAX_RETRIES) {
        await processSingleFile({ ...item, retryCount: item.retryCount + 1 });
      } else {
        setFilesQueue(q => q.map(f => f.id === item.id ? { ...f, status: 'error', errorMsg: err.message } : f));
      }
    }
  };

  const updateItemStatus = (id: string, status: FileItem['status']) => {
    setFilesQueue(q => q.map(f => f.id === id ? { ...f, status } : f));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f, status: 'pending' as const, retryCount: 0
      }));
      setFilesQueue(prev => [...prev, ...newItems]);
    }
  };

  const stats = useMemo(() => ({
    total: filesQueue.length,
    success: filesQueue.filter(f => f.status === 'success').length,
    pending: filesQueue.filter(f => f.status !== 'success' && f.status !== 'error').length,
    error: filesQueue.filter(f => f.status === 'error').length
  }), [filesQueue]);

  const filteredQueue = useMemo(() => {
    return filesQueue.filter(f => f.file.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [filesQueue, searchTerm]);

  const selectedItem = filesQueue.find(f => f.id === selectedFileId);
  const selectedResult = selectedItem?.result;

  return (
    <div className="p-8 pb-24 max-w-[1600px] mx-auto font-sans min-h-screen bg-[#F8FAFC] text-slate-900">
      
      {/* 顶部标题栏 */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-10 gap-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4">
            AI 知识工场 <span className="text-blue-600 font-mono tracking-normal">v3.1</span>
          </h1>
          <p className="text-slate-500 font-medium italic mt-2">完全剥离后端依赖。支持纯前端环境多格式极速特征提取与快照截取。</p>
        </div>

        <div className="flex gap-4">
           <div className="bg-white p-5 px-8 rounded-[28px] shadow-sm border border-slate-100 text-center min-w-[140px]">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Processed</p>
              <p className="text-2xl font-black text-blue-600">{stats.success} / {stats.total}</p>
           </div>
           <button 
             onClick={startBatchProcess}
             disabled={isProcessing || stats.pending === 0}
             className="px-10 py-4 bg-slate-900 text-white rounded-3xl font-black text-sm hover:scale-105 transition-all shadow-2xl shadow-slate-200 disabled:opacity-20 flex items-center gap-2"
           >
             {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
             执行批量解析任务
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左侧控制区 */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-4 rounded-[28px] shadow-sm border border-slate-100 flex items-center gap-3">
             <div className="relative flex-1">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
               <input 
                type="text" placeholder="搜索队列文档..." 
                className="w-full bg-slate-50 border-none rounded-2xl py-3.5 pl-11 text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
               />
             </div>
             <button onClick={() => setShowModelMenu(!showModelMenu)} className="bg-white border border-slate-100 p-3 rounded-2xl relative shadow-sm hover:border-blue-400 transition-all">
                <Cpu className={`w-5 h-5 ${currentModel.color}`} />
                <AnimatePresence>
                   {showModelMenu && (
                     <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="absolute top-full mt-2 right-0 w-48 bg-white shadow-2xl rounded-2xl p-2 z-[100] border">
                        {AVAILABLE_MODELS.map(m => (
                          <div key={m.id} onClick={() => {setCurrentModel(m); setShowModelMenu(false);}} className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer text-xs font-bold">{m.name}</div>
                        ))}
                     </motion.div>
                   )}
                </AnimatePresence>
             </button>
          </div>

          <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFileSelect({ target: { files: e.dataTransfer.files } } as any); }} className="group relative h-48 bg-blue-600 rounded-[40px] flex flex-col items-center justify-center overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-2xl shadow-blue-200">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-800 opacity-90 group-hover:scale-110 transition-transform duration-700" />
            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={handleFileSelect} />
            <UploadCloud className="w-12 h-12 text-white mb-4 animate-bounce" />
            <p className="font-black uppercase tracking-[0.2em] text-[10px] text-white text-center px-6">纯前端架构：支持 DOCS, PPTX, MP4, PDF</p>
          </div>

          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm flex flex-col h-[500px] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {filteredQueue.map((item: FileItem) => (
                <div key={item.id} onClick={() => (item.status === 'success' || item.status === 'error') && setSelectedFileId(item.id)} className={`p-4 rounded-[24px] flex items-center justify-between group transition-all cursor-pointer border ${selectedFileId === item.id ? 'bg-slate-900 border-slate-900 shadow-xl' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-slate-200'}`}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-3 rounded-2xl ${selectedFileId === item.id ? 'bg-slate-800 text-blue-400' : 'bg-white text-slate-300 border shadow-sm'}`}>
                      {item.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : item.status === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${selectedFileId === item.id ? 'text-white' : 'text-slate-700'}`}>{item.file.name}</p>
                      <span className={`text-[9px] font-black uppercase mt-1 block tracking-widest ${item.status === 'success' ? 'text-green-500' : item.status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                        {item.status === 'pending' && '等待中'}
                        {item.status === 'extracting' && '读取文本...'}
                        {item.status === 'capturing' && '本地截取视效...'}
                        {item.status === 'analyzing' && 'AI 数据提取中...'}
                        {item.status === 'success' && (item.skipVisual ? '完成(纯净文本)' : '处理完成')}
                      </span>
                    </div>
                  </div>
                  {['extracting', 'capturing', 'analyzing'].includes(item.status) && <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-2" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：详情视图 */}
        <div className="lg:col-span-8 bg-[#0F172A] rounded-[56px] p-12 shadow-2xl relative overflow-hidden flex flex-col min-h-[850px]">
           {!selectedFileId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                 <div className="p-8 bg-white/5 rounded-full mb-8 border border-white/5 shadow-inner"><Sparkles className="w-16 h-16 text-blue-500/30" /></div>
                 <h2 className="text-white font-black text-2xl tracking-tighter uppercase">Knowledge Neural Center</h2>
                 <p className="text-slate-500 text-sm mt-4 max-w-sm">引擎就绪。正在以零服务器依赖的方式，提取媒体资产与核心语义入库。</p>
              </div>
           ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 flex-1 flex flex-col">
                 <div className="flex items-center justify-between mb-12 pb-8 border-b border-white/5">
                    <div className="flex items-center gap-6">
                       <div className="p-5 bg-blue-600/20 rounded-[28px] border border-blue-500/30 text-blue-400 shadow-xl"><FileJson className="w-8 h-8" /></div>
                       <div>
                          <h3 className="text-white font-black text-2xl tracking-tight leading-none">{selectedResult?.title}</h3>
                          <div className="flex items-center gap-3 mt-4">
                             <span className="text-blue-400 bg-blue-400/5 text-[9px] font-black uppercase tracking-[0.2em] border border-blue-400/20 px-2.5 py-1 rounded-lg">Module: {selectedResult?.module}</span>
                             <span className="text-green-400 bg-green-400/5 text-[9px] font-black uppercase tracking-[0.2em] border border-green-400/20 px-2.5 py-1 rounded-lg flex items-center gap-2"><Check className="w-2.5 h-2.5" /> Data Saved</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-12">
                    {/* 降级提示信息 */}
                    {selectedItem?.skipVisual && (
                      <div className="bg-blue-600/10 border border-blue-600/20 p-6 rounded-[32px] flex items-start gap-4">
                         <Info className="w-6 h-6 text-blue-400 shrink-0" />
                         <div>
                            <h4 className="text-blue-400 font-black text-sm uppercase mb-1">资产剥离通知 / Media Exclusion</h4>
                            <p className="text-slate-400 text-xs leading-relaxed">
                              系统检测到当前文档为纯文本结构，内部无配图资源。已自动归档为轻量级文本条目。
                            </p>
                         </div>
                      </div>
                    )}

                    {/* 截图胶片墙 */}
                    {selectedResult?.page_screenshots && selectedResult.page_screenshots.length > 0 && (
                      <section>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                           <ImageIcon className="w-4 h-4" /> 视觉快照集 (Capture Stream)
                        </h4>
                        <div className="flex gap-5 overflow-x-auto pb-6 snap-x custom-scrollbar">
                           {selectedResult.page_screenshots.map((url, i) => (
                             <div key={url} className="flex-none w-56 aspect-[3/4] bg-white/5 rounded-[32px] overflow-hidden border border-white/10 group relative snap-start hover:border-blue-500 transition-all shadow-2xl">
                                <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={`Snapshot ${i+1}`} />
                                <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full text-[8px] font-black text-white border border-white/10 tracking-widest">SNAP.{i+1}</div>
                             </div>
                           ))}
                        </div>
                      </section>
                    )}

                    <section className="bg-white/[0.02] p-10 rounded-[48px] border border-white/5 relative shadow-inner">
                       <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-6">AI 核心摘要解析</h4>
                       <div className="italic text-slate-300 text-xl leading-relaxed font-light">“{selectedResult?.description}”</div>
                       <div className="flex flex-wrap gap-3 mt-10">
                          {selectedResult?.tags.map(t => (
                            <span key={t} className="px-5 py-2 bg-white/5 rounded-2xl text-[9px] font-black text-slate-400 uppercase tracking-widest border border-white/5">#{t}</span>
                          ))}
                       </div>
                    </section>
                 </div>
              </motion.div>
           )}
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}