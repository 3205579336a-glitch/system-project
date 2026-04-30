'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, Image as ImageIcon, X, Link as LinkIcon, 
  CheckCircle2, AlertCircle, Clock, Layers,
  Upload, Activity, LifeBuoy, FileText, ChevronRight,
  Loader2,Search
} from 'lucide-react';
import Link from 'next/link';

const SYSTEM_OPTIONS = [
  'SAP MM (采购)', 
  'CDW (数据仓库)', 'ODC', 'VIVA', 'Action Portal', '其他系统'
];

export default function SupportDashboard() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表单状态
  const [system, setSystem] = useState('');
  const [intendedAction, setIntendedAction] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [recordingLink, setRecordingLink] = useState('');
  const [images, setImages] = useState<string[]>([]); // 生产环境建议先传 Storage 拿 URL
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🌟 1. 初始化拉取数据
  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/support-tickets');
      const json = await res.json();
      if (json.success) setTickets(json.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchTickets(); }, []);

  // 🌟 2. 动态计算统计数据
  const stats = useMemo(() => ({
    total: tickets.length,
    processing: tickets.filter(t => t.status === 'processing' || t.status === 'pending').length,
    resolved: tickets.filter(t => t.status === 'resolved').length
  }), [tickets]);

  // 🌟 3. 提交工单至 API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!system || !actualResult) return alert('请填入核心信息');

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_module: system,
          intended_action: intendedAction,
          actual_result: actualResult,
          recording_link: recordingLink,
          image_urls: images // 这里暂时存 Base64，建议优化为存储 Storage URL
        })
      });
      const result = await res.json();
      if (result.success) {
        // 提交成功后重新拉取，更新 Dashboard
        fetchTickets();
        // 清空表单
        setSystem(''); setIntendedAction(''); setActualResult(''); setRecordingLink(''); setImages([]);
      }
    } catch (e) { alert('提交失败'); }
    finally { setIsSubmitting(false); }
  };

  // 监听 Ctrl+V 粘贴截图
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (e) => setImages(prev => [...prev, e.target?.result as string]);
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => setImages(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };


  return (
    <div className="min-h-screen bg-[#F4F7FB] py-8 px-4 sm:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* 顶部 Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">IT 支持工作台</h1>
            <p className="text-slate-500 mt-1 font-medium">早上好！需要协助吗？直接在下方描述您遇到的问题。</p>
          </div>
          <Link href="/system-case" className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm flex items-center gap-2">
            <Search size={18} />
            浏览知识库
          </Link>
        </div>

        {/* 🌟 核心：统计卡片区 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1 */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold text-slate-400 mb-1">累计提报</p>
                <h3 className="text-4xl font-black text-slate-800">{stats.total}</h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
                <FileText size={24} />
              </div>
            </div>
          </div>
          
          {/* Card 2 */}
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl p-6 shadow-lg shadow-blue-500/20 hover:-translate-y-1 transition-transform duration-300 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-sm font-bold text-blue-100 mb-1">正在处理中</p>
                <h3 className="text-4xl font-black">{stats.processing}</h3>
              </div>
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Activity size={24} />
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold text-slate-400 mb-1">已成功解决</p>
                <h3 className="text-4xl font-black text-slate-800">{stats.resolved}</h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl">
                <CheckCircle2 size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* 🌟 核心：左右双栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左侧：提单表单 (占 2/3) */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
            <div className="p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <LifeBuoy size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">新建支持工单 (New Ticket)</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Layers size={16} className="text-indigo-500" /> 关联系统 / 模块 <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={system}
                    onChange={(e) => setSystem(e.target.value)}
                    className="w-full px-5 py-4 bg-[#F8FAFC] border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all appearance-none cursor-pointer font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <option value="">请选择发生问题的系统...</option>
                    {SYSTEM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-500" /> 1. 原本期望的操作？
                    </label>
                    <textarea 
                      rows={4}
                      value={intendedAction}
                      onChange={(e) => setIntendedAction(e.target.value)}
                      placeholder="例：尝试批量修改交货冻结状态..."
                      className="w-full px-5 py-4 bg-[#F8FAFC] border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-slate-700 placeholder:text-slate-400 resize-none font-medium"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-500" /> 2. 实际故障现象？ <span className="text-red-500">*</span>
                    </label>
                    <textarea 
                      rows={4}
                      value={actualResult}
                      onChange={(e) => setActualResult(e.target.value)}
                      placeholder="例：弹出红字报错 'Buyer Code缺失'..."
                      className="w-full px-5 py-4 bg-[#F8FAFC] border-2 border-transparent rounded-2xl focus:bg-white focus:border-rose-400 focus:ring-4 focus:ring-rose-50 outline-none transition-all text-slate-700 placeholder:text-slate-400 resize-none font-medium"
                    />
                  </div>
                </div>

                {/* 高级上传区 */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <ImageIcon size={16} className="text-blue-500" /> 3. 错误截图 (支持 Ctrl+V)
                  </label>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative border-2 border-dashed border-slate-200 bg-[#F8FAFC] rounded-2xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer overflow-hidden"
                  >
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
                    <div className="flex flex-col items-center gap-3 relative z-10">
                      <div className="p-4 bg-white shadow-sm rounded-2xl text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all duration-300">
                        <Upload size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-600">点击上传 或直接 <span className="text-blue-600">Ctrl+V 粘贴</span></p>
                        <p className="text-xs text-slate-400 mt-1 font-medium">一张图胜过千言万语，支持多图</p>
                      </div>
                    </div>
                  </div>

                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-4 mt-4">
                      {images.map((img, index) => (
                        <div key={index} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm animate-in fade-in zoom-in">
                          <img src={img} alt="preview" className="w-full h-full object-cover" />
                          <button 
                            type="button" onClick={(e) => { e.stopPropagation(); setImages(prev => prev.filter((_, i) => i !== index)); }}
                            className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full md:w-auto md:px-12 py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-lg ml-auto ${
                      isSubmitting 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/25 active:scale-[0.98]'
                    }`}
                  >
                    {isSubmitting ? <><Loader2 className="animate-spin" size={20} /> 处理中...</> : <><Send size={20} /> 提交至支持中心</>}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* 右侧：近期工单 (占 1/3) */}
          <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Clock size={18} className="text-slate-400" /> 近期工单动态
              </h2>
            </div>
            
            <div className="space-y-6">
              {/* 🌟 1. 改用 tickets 变量，并只截取前 5 条 */}
              {tickets.slice(0, 5).map((ticket, i) => (
                <div key={ticket.id} className="group relative pl-6 border-l-2 border-slate-100 pb-6 last:pb-0 last:border-transparent">
                  {/* 时间轴圆点 */}
                  <div className={`absolute left-[-5px] top-1 w-2 h-2 rounded-full ring-4 ring-white ${
                    (ticket.status === 'processing' || ticket.status === 'pending') ? 'bg-indigo-500' : 'bg-emerald-500'
                  }`}></div>
                  
                  <div className="flex justify-between items-start mb-1">
                    {/* 🌟 2. 映射数据库的 case_id 和 created_at */}
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{ticket.case_id}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <h4 className="text-sm font-bold text-slate-700 mb-2 leading-snug group-hover:text-blue-600 transition-colors cursor-pointer truncate">
                    {/* 🌟 3. 组合系统名和实际报错作为标题展示 */}
                    {ticket.system_module}: {ticket.actual_result}
                  </h4>
                  
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    (ticket.status === 'processing' || ticket.status === 'pending')
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}>
                    {(ticket.status === 'processing' || ticket.status === 'pending') ? '处理中' : '已解决'}
                  </span>
                </div>
              ))}
            </div>

            <button className="w-full mt-8 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-1 group">
              查看全部工单历史 <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}