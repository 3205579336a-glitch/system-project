'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, Play, FileText, Clock, TrendingUp, Star, 
  ChevronRight, ChevronLeft, PlayCircle, Bookmark, 
  Sparkles, Layers, BookOpen, User, Tag
} from 'lucide-react';
import { motion, Variants, AnimatePresence } from 'framer-motion';

// --- 模拟 Link 组件，解决环境编译错误 ---
const Link = ({ href, children, className }: { href: string, children: React.ReactNode, className?: string }) => (
  <a href={href} className={className}>{children}</a>
);

// --- 独立抽出的内容卡片组件 ---
const ContentCard = ({ item }: { item: any }) => (
  <Link href={`/training/${item.id}`} className="group relative flex-none shrink-0 w-72 cursor-pointer snap-start block">
    <div className={`relative aspect-video rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-sm overflow-hidden mb-4 transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-xl`}>
      {/* 封面展示逻辑：优先使用 AI 生成的缩略图 */}
      {item.thumbnail_url ? (
        <img src={item.thumbnail_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-40">
           {item.type === 'video' ? <PlayCircle className="w-12 h-12" /> : <FileText className="w-12 h-12" />}
        </div>
      )}
      
      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
        <div className="p-3 bg-white/20 rounded-full backdrop-blur-md">
          {item.type === 'video' ? <PlayCircle className="w-8 h-8 text-white" /> : <BookOpen className="w-8 h-8 text-white" />}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-black px-2 py-1 rounded-lg backdrop-blur-md flex items-center gap-1 uppercase tracking-widest">
        {item.type}
      </div>
      
      {/* 模块标签 */}
      <div className="absolute top-3 left-3 bg-white/90 text-blue-600 text-[10px] font-black px-2 py-1 rounded-lg shadow-sm uppercase tracking-tighter">
        {item.module}
      </div>
    </div>

    <h3 className="font-bold text-slate-900 leading-snug line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors h-10">
      {item.title}
    </h3>
    
    <div className="flex items-center text-[10px] text-slate-400 gap-3 font-bold uppercase tracking-widest">
      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {item.author || 'IT Team'}</span>
      <span className="flex items-center gap-1 text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
        <Tag className="w-2.5 h-2.5" /> {item.role}
      </span>
    </div>
  </Link>
);

// --- 顶级交互：智能边界检测泳道组件 ---
function SwimlaneRow({ title, items }: { title: React.ReactNode, items: any[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollState = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollState();
    window.addEventListener('resize', checkScrollState);
    return () => window.removeEventListener('resize', checkScrollState);
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -800 : 800; 
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="mb-12">
      <div className="flex justify-between items-center mb-6 px-2">
        {title}
        <div className="flex gap-2">
           <button 
             onClick={() => scroll('left')}
             disabled={!canScrollLeft}
             className={`p-2 rounded-full border border-slate-200 bg-white transition-all ${canScrollLeft ? 'opacity-100 hover:bg-slate-50 shadow-sm' : 'opacity-20 cursor-not-allowed'}`}
           >
             <ChevronLeft className="w-4 h-4" />
           </button>
           <button 
             onClick={() => scroll('right')}
             disabled={!canScrollRight}
             className={`p-2 rounded-full border border-slate-200 bg-white transition-all ${canScrollRight ? 'opacity-100 hover:bg-slate-50 shadow-sm' : 'opacity-20 cursor-not-allowed'}`}
           >
             <ChevronRight className="w-4 h-4" />
           </button>
        </div>
      </div>
      
      <div 
        ref={scrollRef} 
        onScroll={checkScrollState}
        className="flex gap-8 overflow-x-auto pb-6 px-2 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <ContentCard key={item.id} item={item} />
        ))}
        {/* 占位符确保最后一张卡片能对齐 */}
        <div className="w-20 shrink-0" />
      </div>
    </div>
  );
}

export default function TrainingHub() {
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  // --- 1. 动态加载 Supabase 并获取数据 ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!(window as any).supabase) {
          await new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
            script.onload = resolve;
            document.head.appendChild(script);
          });
        }
        const win = window as any;
        const supabase = win.supabase.createClient(
          "https://yzeefqpguywxobxprehb.supabase.co",
          "sb_publishable_RHi0eVDrudtOORT3oruOzQ_lpsXXhoL"
        );

        const { data, error } = await supabase
          .from('learning_contents')
          .select('*')
          .order('updated_at', { ascending: false });

        if (error) throw error;
        setContents(data || []);
      } catch (err) {
        console.error("Fetch Data Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- 2. 过滤逻辑 ---
  const filteredData = useMemo(() => {
    return contents.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'All' || 
                         (activeTab === 'Video' && item.type === 'video') ||
                         (activeTab === 'Docs' && item.type !== 'video');
      return matchesSearch && matchesTab;
    });
  }, [contents, searchTerm, activeTab]);

  // --- 3. 自动根据 Module 分组生成泳道 ---
  const moduleGroups = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredData.forEach(item => {
      if (!groups[item.module]) groups[item.module] = [];
      groups[item.module].push(item);
    });
    return groups;
  }, [filteredData]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white">
        <Sparkles className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">正在构建 AI 知识大厅...</p>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 pb-24 max-w-[1600px] mx-auto font-sans bg-[#FBFBFE] min-h-screen">
      
      {/* 顶部搜索与标题 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-12 gap-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">知识资产中心</h1>
            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded uppercase">Live</span>
          </div>
          <p className="text-slate-500 font-medium italic">汇聚 200+ 由 AI 深度解析的业务文档与操作视频</p>
        </div>
        
        <div className="relative group min-w-[400px]">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text" 
            placeholder="搜索华语摘要、系统模块、标题..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-[24px] shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all font-medium text-slate-700"
          />
        </div>
      </div>

      {/* 快速分类 Tab */}
      <div className="flex gap-3 mb-12 border-b border-slate-100 pb-6 overflow-x-auto">
        {['All', 'Video', 'Docs', 'Favorites'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-2.5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 动态泳道渲染 */}
      <div className="space-y-4">
        {Object.keys(moduleGroups).length > 0 ? (
          Object.entries(moduleGroups).map(([moduleName, items]) => (
            <SwimlaneRow 
              key={moduleName}
              title={
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-blue-600 rounded-full" />
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{moduleName}</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total {items.length} Assets</p>
                  </div>
                </div>
              }
              items={items} 
            />
          ))
        ) : (
          <div className="py-40 text-center bg-white rounded-[48px] border-2 border-dashed border-slate-100">
             <Layers className="w-16 h-16 text-slate-100 mx-auto mb-4" />
             <p className="text-slate-400 font-bold uppercase tracking-widest">未检索到符合条件的知识资产</p>
          </div>
        )}
      </div>

      <style jsx global>{`
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
    </div>
  );
}