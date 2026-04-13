"use client";

import { useState, useEffect, use, useRef } from 'react';
import { 
  ArrowLeft, Share2, ThumbsUp, BookmarkPlus, PlayCircle, 
  FileText, CheckCircle2, Link as LinkIcon, User, 
  Clock, Tag, ShieldCheck, ExternalLink, Sparkles, 
  Download, Eye
} from 'lucide-react';

// 模拟 Link 组件，解决 Next.js 环境编译错误
const Link = ({ href, children, className }: { href: string, children: React.ReactNode, className?: string }) => (
  <a href={href} className={className}>{children}</a>
);

// 视频播放器组件
const VideoPlayer = ({ url, title }: { url: string, title: string }) => (
  <iframe 
    src={url} 
    className="w-full aspect-video bg-black shadow-2xl" 
    title={title}
    allowFullScreen
  />
);

export default function TrainingDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [relatedContent, setRelatedContent] = useState<any[]>([]);
  const [isNotFound, setIsNotFound] = useState(false);
  const supabaseRef = useRef<any>(null);

  // --- 辅助函数：处理 Office 文档预览 URL ---
  const getPreviewUrl = (originalUrl: string) => {
    if (!originalUrl) return "";
    const lowerUrl = originalUrl.toLowerCase();
    // 如果是 Word, PPT, Excel，使用 Microsoft Office Online Viewer 预览
    if (lowerUrl.includes('.docx') || lowerUrl.includes('.pptx') || lowerUrl.includes('.xlsx') || lowerUrl.includes('.doc') || lowerUrl.includes('.ppt')) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(originalUrl)}`;
    }
    // PDF 和 图片浏览器通常可以直接渲染
    return originalUrl;
  };

  // --- 1. 动态加载 Supabase 库并获取数据 ---
  useEffect(() => {
    const initAndFetch = async () => {
      setLoading(true);
      
      try {
        if (!(window as any).supabase) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const win = window as any;
        if (!win.supabase) throw new Error("Supabase SDK 加载失败");

        const supabase = win.supabase.createClient(
          "https://yzeefqpguywxobxprehb.supabase.co",
          "sb_publishable_RHi0eVDrudtOORT3oruOzQ_lpsXXhoL"
        );
        supabaseRef.current = supabase;

        if (!resolvedParams.id) return;

        const { data: item, error } = await supabase
          .from('learning_contents')
          .select('*')
          .eq('id', resolvedParams.id)
          .single();

        if (error || !item) {
          setIsNotFound(true);
          setLoading(false);
          return;
        }

        setData(item);

        const { data: related } = await supabase
          .from('learning_contents')
          .select('id, title, module, url, type, author')
          .eq('module', item.module)
          .neq('id', item.id)
          .limit(6);
        
        setRelatedContent(related || []);
      } catch (err) {
        console.error("Initialization Error:", err);
        setIsNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    initAndFetch();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F9FAFB]">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
          <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-blue-400 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-slate-900 font-bold text-sm tracking-widest uppercase">Initializing Knowledge View</p>
          <p className="text-slate-400 text-xs mt-2 animate-pulse font-medium">正在调取云端存储并加载预览引擎...</p>
        </div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <XCircle className="w-10 h-10 text-red-500 opacity-20" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">知识资产未找到</h1>
        <p className="text-slate-400 mb-8 max-w-xs text-sm">该文档可能已被移动或删除，请联系 IT 支持团队或返回大厅。</p>
        <Link href="/training" className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl active:scale-95 transition-transform">
          返回培训中心
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 pb-24 max-w-[1700px] mx-auto font-sans bg-[#F9FAFB] min-h-screen">
      
      {/* 顶部面包屑与快捷动作 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/training" className="p-2.5 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-slate-400 hover:text-blue-600 border border-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex flex-col">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Knowledge Base</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-900 font-bold">{data.module}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500 max-w-[200px] truncate">{data.title}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-100 shadow-sm hover:bg-slate-50 transition-all">
              <Download className="w-4 h-4" /> 下载附件
           </button>
           <button className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
              <Share2 className="w-4 h-4" /> 分享
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* 左侧主体：文档展示 + AI 详情 */}
        <div className="xl:col-span-8 space-y-8">
          
          {/* 1. 核心预览区 (关键升级) */}
          <div className="w-full rounded-[40px] shadow-2xl shadow-blue-900/10 overflow-hidden border-4 border-white bg-white group relative">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <div className="bg-slate-900/80 backdrop-blur text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Eye className="w-3 h-3 text-blue-400" /> Live Preview
              </div>
            </div>

            {data.type === 'video' ? (
              <VideoPlayer url={data.url} title={data.title} />
            ) : (
              <div className="bg-slate-200 min-h-[850px] relative">
                 <iframe 
                   src={getPreviewUrl(data.url)} 
                   className="w-full h-[850px] border-none bg-white"
                   title={data.title}
                 />
                 {/* 备用操作提示层 */}
                 <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all">
                    <a href={data.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-2xl hover:scale-105 transition-transform">
                       <ExternalLink className="w-4 h-4 text-blue-400" /> 全屏阅读原件
                    </a>
                 </div>
              </div>
            )}
          </div>

          {/* 2. AI 深度解析报告看板 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none rotate-12">
                   <Sparkles className="w-48 h-48 text-blue-600" />
                </div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-200">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter">AI 智能解析报告</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Deep Learning Insight</p>
                  </div>
                </div>

                <div className="relative z-10">
                   <div className="bg-blue-50/40 border-l-[6px] border-blue-500 p-8 rounded-r-[32px] mb-8">
                     <p className="text-slate-700 leading-relaxed text-xl font-medium italic">
                       “{data.description}”
                     </p>
                   </div>
                   
                   <div className="flex flex-wrap gap-2.5">
                     {data.tags?.map((tag: string) => (
                       <span key={tag} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-colors">
                         <Tag className="w-3.5 h-3.5" /> {tag}
                       </span>
                     ))}
                   </div>
                </div>
            </div>

            <div className="md:col-span-4">
               <div className="bg-[#0F172A] p-10 rounded-[48px] text-white shadow-2xl h-full flex flex-col border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em] mb-10">Quick Connect</h3>
                  
                  <div className="space-y-4 flex-1">
                     {data.extracted_links && data.extracted_links.length > 0 ? (
                        data.extracted_links.map((link: any, idx: number) => (
                          <a key={idx} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-5 p-5 rounded-3xl bg-white/[0.03] hover:bg-blue-600 transition-all group border border-white/5 hover:border-blue-400/50">
                             <div className="p-2.5 bg-white/10 rounded-xl group-hover:bg-white/20 shadow-inner">
                               <ShieldCheck className="w-5 h-5 text-blue-400 group-hover:text-white" />
                             </div>
                             <div className="min-w-0">
                               <p className="text-xs font-black truncate">{link.title}</p>
                               <p className="text-[9px] opacity-40 font-bold uppercase mt-1 tracking-tighter">前往执行指令</p>
                             </div>
                          </a>
                        ))
                     ) : (
                        <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[32px] opacity-20 bg-black/20">
                           <LinkIcon className="w-10 h-10 mx-auto mb-3" />
                           <p className="text-[10px] font-black uppercase tracking-widest">No External Links</p>
                        </div>
                     )}
                  </div>

                  <button className="w-full mt-10 py-5 bg-white text-slate-900 rounded-[24px] font-black text-xs uppercase tracking-[0.1em] hover:scale-105 transition-all shadow-2xl shadow-blue-500/10 active:scale-95">
                    收藏至我的书架
                  </button>
               </div>
            </div>
          </div>
        </div>

        {/* 右侧：属性详情 & 知识流推荐 */}
        <div className="xl:col-span-4 space-y-8">
          
          {/* 属性核心卡 */}
          <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm relative overflow-hidden">
             <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-blue-600 text-[11px] font-black uppercase tracking-[0.2em]">Module Category</span>
                </div>
                <h1 className="text-3xl font-black text-slate-900 leading-[1.1] tracking-tight">{data.title}</h1>
             </div>

             <div className="space-y-8 pt-8 border-t border-slate-50">
                {[
                  { label: 'Content Publisher', val: data.author || 'IT Support Team', icon: User, color: 'text-blue-500', bg: 'bg-blue-50' },
                  { label: 'System Last Update', val: data.updated_at ? new Date(data.updated_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : '2024年3月15日', icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50' },
                  { label: 'Target Audience', val: data.role, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-5 group">
                     <div className={`w-12 h-12 rounded-[18px] ${item.bg} flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform shadow-sm`}>
                        <item.icon className="w-6 h-6" />
                     </div>
                     <div>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{item.label}</p>
                       <p className="text-[15px] font-bold text-slate-800">{item.val}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>

          {/* 知识流推荐 */}
          <div className="space-y-5">
            <div className="flex items-center justify-between px-4">
               <h3 className="font-black text-slate-900 text-xs uppercase tracking-[0.15em]">相关知识流</h3>
               <button className="text-[10px] font-black text-blue-600 uppercase hover:underline">Explore More</button>
            </div>
            <div className="grid gap-4">
              {relatedContent.map((item) => (
                <Link href={`/training/${item.id}`} key={item.id} className="block group">
                  <div className="bg-white p-5 rounded-[32px] border border-slate-50 shadow-sm group-hover:shadow-xl group-hover:border-blue-100 group-hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center text-slate-400 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner`}>
                         {item.type === 'video' ? <PlayCircle className="w-7 h-7" /> : <FileText className="w-7 h-7" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest mb-1">{item.module}</p>
                        <h4 className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{item.title}</h4>
                        <div className="flex items-center gap-2 mt-2">
                           <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center"><User className="w-3 h-3 text-slate-400" /></div>
                           <span className="text-[10px] text-slate-400 font-bold">{item.author}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {relatedContent.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-[48px] bg-white/50">
                   <FileText className="w-10 h-10 text-slate-100 mx-auto mb-3" />
                   <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em]">End of Module Queue</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
      
      <style jsx global>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
}

// 图标组件补齐
function XCircle(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>;
}