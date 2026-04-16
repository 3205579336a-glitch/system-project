"use client";

import { useState, useEffect, use, useRef } from 'react';
import { createClient } from '@supabase/supabase-js'; // 🌟 新增正规引入
import { 
  ArrowLeft, Share2, ThumbsUp, ThumbsDown, BookmarkPlus, PlayCircle, 
  FileText, CheckCircle2, Link as LinkIcon, User, 
  Clock, Tag, ShieldCheck, ExternalLink, Sparkles, 
  Download, Eye, Play, Bookmark, BookmarkCheck, Star
} from 'lucide-react';

const Link = ({ href, children, className }: { href: string, children: React.ReactNode, className?: string }) => (
  <a href={href} className={className}>{children}</a>
);

const VideoPlayer = ({ url, title }: { url: string, title: string }) => (
  <iframe 
    src={url} 
    className="w-full aspect-video bg-slate-900 rounded-b-none md:rounded-3xl shadow-sm" 
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
  const [sessionId, setSessionId] = useState<string>('');
  
  // 🌟 真实互动状态 (从数据库映射)
  const [isFavorite, setIsFavorite] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const [stats, setStats] = useState({ likes: 0, views: 0 });
  
  const supabaseRef = useRef<any>(null);

  const getPreviewUrl = (originalUrl: string) => {
    if (!originalUrl) return "";
    const lowerUrl = originalUrl.toLowerCase();
    if (lowerUrl.includes('.docx') || lowerUrl.includes('.pptx') || lowerUrl.includes('.xlsx') || lowerUrl.includes('.doc')) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(originalUrl)}`;
    }
    return originalUrl;
  };

  // --- 🌟 核心埋点引擎：将数据喂给未来的推荐算法 ---
  const trackAction = async (actionType: string, specificModule?: string) => {
    if (!supabaseRef.current || !resolvedParams.id || !sessionId) return;
    try {
      // 1. 写入用户行为日志表
      await supabaseRef.current.from('user_interactions').insert([{
        session_id: sessionId,
        content_id: resolvedParams.id,
        module: specificModule || data?.module || 'General',
        action_type: actionType
      }]);

      // 2. 累加主表的公开统计数字
      const counterColumn = `${actionType}s_count`; 
      if (['view', 'like', 'dislike', 'share', 'download'].includes(actionType)) {
        const { data: currentData } = await supabaseRef.current.from('learning_contents').select(counterColumn).eq('id', resolvedParams.id).single();
        if (currentData) {
          const newVal = (currentData[counterColumn] || 0) + 1;
          await supabaseRef.current.from('learning_contents').update({ [counterColumn]: newVal }).eq('id', resolvedParams.id);
        }
      }
    } catch (err) { console.warn("埋点记录失败", err); }
  };

  useEffect(() => {
    // 初始化匿名设备指纹
    let currentSession = localStorage.getItem('device_session_id');
    if (!currentSession) {
      currentSession = `sess_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      localStorage.setItem('device_session_id', currentSession);
    }
    setSessionId(currentSession);

    const initAndFetch = async () => {
      setLoading(true);
      try {
        // 🌟 修复点：直接使用引入的 createClient，彻底解决 window.supabase 未定义的问题
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
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
          return;
        }
        setData(item);
        setStats({ likes: item.likes_count || 0, views: item.views_count || 0 });

        // 拉取同模块推荐
        const { data: related } = await supabase
          .from('learning_contents')
          .select('id, title, module, url, type, author, thumbnail_url')
          .eq('module', item.module)
          .neq('id', item.id)
          .limit(6);
        setRelatedContent(related || []);
        
        // 读取收藏与点赞状态
        const savedFavs = localStorage.getItem('hub_favorites');
        if (savedFavs && JSON.parse(savedFavs).includes(item.id)) setIsFavorite(true);
        const savedLikes = localStorage.getItem(`hub_feedback_${item.id}`);
        if (savedLikes) setFeedback(savedLikes as 'like' | 'dislike');

        // 🔥 核心：记录有效浏览 (View)
        if (currentSession) {
          supabase.from('user_interactions').insert([{
            session_id: currentSession, content_id: item.id, module: item.module, action_type: 'view'
          }]).then();
        }

      } catch (err) {
        console.error("加载详情失败:", err);
        setIsNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    initAndFetch();
  }, [resolvedParams.id]);

  // --- 真实互动操作函数 ---
  
  const handleToggleFavorite = () => {
    const nextState = !isFavorite;
    setIsFavorite(nextState);
    const savedFavs = JSON.parse(localStorage.getItem('hub_favorites') || '[]');
    const newFavs = nextState ? [...savedFavs, data.id] : savedFavs.filter((id: string) => id !== data.id);
    localStorage.setItem('hub_favorites', JSON.stringify(newFavs));
    
    if (nextState) trackAction('favorite');
  };

  const handleFeedback = (type: 'like' | 'dislike') => {
    if (feedback === type) return; // 已选则忽略
    setFeedback(type);
    localStorage.setItem(`hub_feedback_${data.id}`, type);
    trackAction(type);
    
    if (type === 'like') setStats(s => ({ ...s, likes: s.likes + 1 }));
  };

  const handleShare = async () => {
    trackAction('share');
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          text: `来看看这个 ${data.module} 模块的培训资源：${data.title}`,
          url: window.location.href
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('分享链接已复制到剪贴板！');
    }
  };

  const handleDownload = () => {
    trackAction('download');
    // 触发浏览器直接下载行为
    const a = document.createElement('a');
    a.href = data.url;
    a.download = data.title;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
        <p className="font-bold text-sm tracking-[0.2em] uppercase text-slate-400 animate-pulse">Loading Asset...</p>
      </div>
    );
  }

  if (isNotFound) return <div className="h-screen flex items-center justify-center bg-[#F8FAFC] text-slate-500 font-bold">未找到内容或已被删除</div>;

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-700 font-sans selection:bg-blue-200">
      
      <nav className="sticky top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <Link href="/training" className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-bold transition-colors">
          <div className="p-2 bg-slate-100 rounded-full border border-slate-200"><ArrowLeft className="w-4 h-4" /></div>
          <span>返回大厅</span>
        </Link>
      </nav>

      <div className="w-full bg-[#F8FAFC] pt-6 md:pt-10">
        <div className="max-w-[1600px] mx-auto md:px-8">
           <div className="w-full aspect-video md:rounded-3xl overflow-hidden shadow-xl relative bg-white border border-slate-200">
              {data.type === 'video' ? <VideoPlayer url={data.url} title={data.title} /> : (
                <div className="w-full h-full relative group">
                  <iframe src={getPreviewUrl(data.url)} className="w-full h-full border-none bg-white" title={data.title} />
                  <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={data.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xl transition-transform hover:scale-105">
                      <ExternalLink className="w-4 h-4" /> 独立窗口阅读
                    </a>
                  </div>
                </div>
              )}
           </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-10 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          <div className="lg:col-span-8 space-y-10">
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-blue-600 font-black tracking-[0.1em] uppercase text-[11px]">{data.module || 'General'}</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="text-slate-500 font-medium text-xs flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {stats.views} 次浏览</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-slate-200">{data.role}</span>
              </div>
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-8">
                {data.title}
              </h1>

              {/* 真实互动的控制台 */}
              <div className="flex items-center gap-3 flex-wrap bg-white p-2 md:p-3 rounded-2xl md:rounded-full border border-slate-200 shadow-sm w-fit">
                
                <button className="flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-slate-800 transition-colors shadow-md">
                  <Play className="w-4 h-4 fill-current" /> {data.type === 'video' ? '播放视频' : '阅读文档'}
                </button>

                <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block"></div>

                <div className="flex items-center gap-1">
                  <button onClick={() => handleFeedback('like')} title="点赞" className={`flex items-center gap-1.5 px-4 h-12 rounded-full transition-all ${feedback === 'like' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'hover:bg-slate-50 text-slate-500'}`}>
                    <ThumbsUp className={`w-5 h-5 ${feedback === 'like' ? 'fill-current' : ''}`} />
                    <span className="text-sm font-bold">{stats.likes > 0 ? stats.likes : '赞'}</span>
                  </button>
                  <button onClick={() => handleFeedback('dislike')} title="点踩" className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${feedback === 'dislike' ? 'bg-red-50 text-red-600 border border-red-200' : 'hover:bg-slate-50 text-slate-500'}`}>
                    <ThumbsDown className={`w-5 h-5 ${feedback === 'dislike' ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block"></div>

                <button onClick={handleToggleFavorite} title="收藏至工作台" className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${isFavorite ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' : 'hover:bg-slate-50 text-slate-500'}`}>
                  {isFavorite ? <BookmarkCheck className="w-5 h-5 fill-current" /> : <BookmarkPlus className="w-5 h-5" />}
                </button>
                <button onClick={handleShare} title="分享" className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-slate-50 text-slate-500 transition-all">
                  <Share2 className="w-5 h-5" />
                </button>
                <button onClick={handleDownload} title="下载副本" className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-slate-50 text-slate-500 transition-all">
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-5">
                <div className="bg-blue-100 p-1.5 rounded-lg"><Sparkles className="w-4 h-4 text-blue-600" /></div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">AI 摘要解析</h3>
              </div>
              <p className="text-lg text-slate-600 leading-relaxed font-medium bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                {data.description || "暂无详细的 AI 摘要内容。"}
              </p>
              <div className="flex flex-wrap gap-2 mt-6">
                {data.tags?.map((tag: string) => (
                  <span key={tag} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-sm cursor-default">{tag}</span>
                ))}
              </div>
            </div>
            
            {/* 外部指令链接 */}
            {data.extracted_links && data.extracted_links.length > 0 && (
              <div className="pt-8 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">快捷操作直达</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.extracted_links.map((link: any, idx: number) => (
                    <a key={idx} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 rounded-2xl bg-white hover:border-blue-300 border border-slate-200 shadow-sm transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><LinkIcon className="w-4 h-4" /></div>
                        <span className="font-bold text-sm text-slate-800">{link.title}</span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-slate-600" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">相关推荐 (Up Next)</h3>
            <div className="flex flex-col gap-3">
              {relatedContent.map((item) => (
                <Link href={`/training/${item.id}`} key={item.id} className="group flex gap-4 p-3 -mx-3 rounded-2xl hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition-all">
                  <div className="relative w-32 md:w-40 aspect-video rounded-xl overflow-hidden bg-slate-200 shrink-0">
                    {item.thumbnail_url && <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 group-hover:bg-slate-900/30 transition-colors">
                      {item.type === 'video' ? <PlayCircle className="w-8 h-8 text-white drop-shadow-md" /> : <FileText className="w-8 h-8 text-white drop-shadow-md" />}
                    </div>
                  </div>
                  <div className="flex flex-col justify-center min-w-0 py-1">
                    <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-2 font-semibold truncate">{item.author || 'Volvo IT'}</p>
                  </div>
                </Link>
              ))}
              {relatedContent.length === 0 && (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-white">
                  <p className="text-xs text-slate-400 uppercase tracking-widest">暂无相关内容</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}