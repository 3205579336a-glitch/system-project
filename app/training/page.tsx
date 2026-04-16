'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Search, Play, FileText, Clock, TrendingUp, Star, ChevronRight, ChevronLeft, PlayCircle, Bookmark, BookmarkCheck, Layers } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import Fuse from 'fuse.js';
// --- 初始化 Supabase 客户端 ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// 放在组件外：文本规范化
function normalizeText(input: string = '') {
  return input
    .toString()
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreItem(item: any, query: string) {
  const q = normalizeText(query);
  if (!q) return 0;

  const tokens = q.split(' ').filter(Boolean);

  const title = normalizeText(item.title || '');
  const desc = normalizeText(item.description || '');
  const module = normalizeText(item.module || '');
  const role = normalizeText(item.role || '');
  const typeLabel = normalizeText(item.type === 'video' ? 'video' : 'doc');
  const combined = `${title} ${desc} ${module} ${role} ${typeLabel}`;

  let score = 0;

  // 精确/前缀命中权重最高
  if (title === q) score += 100;
  if (title.startsWith(q)) score += 60;
  if (combined.includes(q)) score += 30;

  // 多关键词分数
  tokens.forEach((token) => {
    if (title.includes(token)) score += 14;
    if (desc.includes(token)) score += 6;
    if (module.includes(token)) score += 10;
    if (role.includes(token)) score += 8;
    if (typeLabel.includes(token)) score += 5;
  });

  // 所有词都在标题里，优先级更高
  if (tokens.length > 1 && tokens.every((t) => title.includes(t))) score += 35;

  // 所有词都能在综合文本里找到
  if (tokens.length > 1 && tokens.every((t) => combined.includes(t))) score += 20;

  return score;
}



// --- 独立抽出的卡片组件 ---
const ContentCard = ({ item, isFavorite, onToggleFavorite }: { item: any, isFavorite: boolean, onToggleFavorite: (e: React.MouseEvent) => void }) => {
  const hasThumbnail = !!item.thumbnail_url;
  const gradientClass = "bg-gradient-to-br from-slate-700 to-slate-900";

  return (
    <Link href={`/training/${item.id}`} className="group relative flex-none shrink-0 w-72 cursor-pointer snap-start block">
      <div className={`relative aspect-video rounded-2xl ${hasThumbnail ? 'bg-black' : gradientClass} shadow-sm overflow-hidden mb-3 transition-transform duration-300 group-hover:scale-[1.03] group-hover:shadow-md`}>
        
        {hasThumbnail && (
          <img src={item.thumbnail_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
        )}

        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
          {item.type === 'video' ? <PlayCircle className="w-12 h-12 text-white opacity-90" /> : <BookOpenIcon className="w-10 h-10 text-white opacity-90" />}
        </div>
        
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded-md backdrop-blur-md flex items-center gap-1">
          {item.type === 'video' ? <Play className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
          {item.type === 'video' ? 'Video' : 'Doc'}
        </div>
        
        <div className="absolute top-2 left-2 bg-white/90 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
          {item.module || 'General'}
        </div>

        {/* 🌟 独立的收藏按钮 */}
        <button 
          onClick={onToggleFavorite}
          className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-all z-10 ${isFavorite ? 'bg-blue-600 text-white' : 'bg-black/50 text-gray-300 hover:bg-black/70 hover:text-white'}`}
        >
          <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>
      
      <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
        {item.title}
      </h3>
      
      <div className="flex items-center text-xs text-gray-500 gap-3 font-medium">
        <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{item.role || 'All Users'}</span>
        <span className="flex items-center gap-1 text-yellow-500"><Star className="w-3 h-3 fill-current" /> 4.9</span>
      </div>
    </Link>
  );
};

// --- 🌟 顶级交互：智能边界检测 + 动效泳道 ---
function SwimlaneRow({ title, items, reverse = false, favorites, toggleFavorite }: { title: React.ReactNode, items: any[], reverse?: boolean, favorites: string[], toggleFavorite: (id: string, e: React.MouseEvent) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayItems = reverse ? [...items].reverse() : items;

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

  if (!items || items.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex justify-between items-end mb-4 pr-4">
        {title}
      </div>
      <div className="relative group/lane">
        <button 
          onClick={() => scroll('left')} 
          className={`absolute left-[-20px] top-[89px] -translate-y-1/2 z-10 bg-white shadow-lg border border-gray-100 p-3 rounded-full transition-all duration-300 hover:scale-110 hover:bg-gray-50 text-gray-800
            ${canScrollLeft ? 'opacity-0 group-hover/lane:opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none scale-90'}
          `}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          ref={scrollRef} 
          onScroll={checkScrollState}
          className="flex gap-6 overflow-x-auto pb-6 pt-2 pl-1 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
        >
          {displayItems.map((item) => (
            <motion.div key={item.id} className="snap-start">
              <ContentCard 
                item={item} 
                isFavorite={favorites.includes(item.id)}
                onToggleFavorite={(e) => toggleFavorite(item.id, e)}
              />
            </motion.div>
          ))}
          <div className="w-6 flex-none shrink-0 snap-end"></div>
        </motion.div>

        <button 
          onClick={() => scroll('right')} 
          className={`absolute right-[-20px] top-[89px] -translate-y-1/2 z-10 bg-white shadow-lg border border-gray-100 p-3 rounded-full transition-all duration-300 hover:scale-110 hover:bg-gray-50 text-gray-800
            ${canScrollRight ? 'opacity-0 group-hover/lane:opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none scale-90'}
          `}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

// --- 页面主体 ---
export default function TrainingHub() {
  const [activeTab, setActiveTab] = useState('For You');
  const [searchTerm, setSearchTerm] = useState('');
  const [contents, setContents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 🌟 收藏夹状态 (通过 localStorage 持久化)
  const [favorites, setFavorites] = useState<string[]>([]);

  const fuse = useMemo(() => {
  return new Fuse(contents, {
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'description', weight: 0.2 },
      { name: 'module', weight: 0.15 },
      { name: 'role', weight: 0.1 },
      { name: 'type', weight: 0.05 },
    ],
    threshold: 0.4, // ⭐ 越小越严格（0.3~0.5最合适）
    ignoreLocation: true,
    includeScore: true,
  });
}, [contents]);

  // 1. 初始化时获取数据和本地收藏夹
  useEffect(() => {
    const fetchContents = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('learning_contents')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && data) setContents(data);
      setIsLoading(false);
    };

    fetchContents();
    
    // 读取本地收藏记录
    const savedFavorites = localStorage.getItem('hub_favorites');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
  }, []);

  // 2. 🌟 真正的核心：数据过滤引擎
const filteredContents = useMemo(() => {
  let result = contents;

  // 1️⃣ 先做 Tab 过滤（你原来的逻辑）
  result = result.filter(item => {
    let tabMatch = true;
    if (activeTab === '🔥 热门视频') tabMatch = item.type === 'video';
    if (activeTab === '📄 SOP 手册') tabMatch = item.type !== 'video';
    if (activeTab === '⭐ 我的收藏') tabMatch = favorites.includes(item.id);
    return tabMatch;
  });

  // 2️⃣ 再做 Fuse 搜索
  if (!searchTerm.trim()) return result;

  const fuseResult = fuse.search(searchTerm);

  return fuseResult.map(r => r.item);
}, [contents, searchTerm, activeTab, favorites, fuse]);

  // 3. 🌟 切换收藏状态的方法
  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id];
      localStorage.setItem('hub_favorites', JSON.stringify(next)); // 同步到本地存储
      return next;
    });
  };

  // 获取 Hero Banner (只有在首页且未搜索时展示最前面的资源)
  const isDefaultView = activeTab === 'For You' && !searchTerm;
  const featuredContent = isDefaultView && filteredContents.length > 0 ? filteredContents[0] : null;
  
  // 切分泳道数据（如果显示了 Hero，则下方泳道剔除第一个）
  const swimlaneData = featuredContent ? filteredContents.slice(1) : filteredContents;
  const videoContent = swimlaneData.filter(c => c.type === 'video');
  const docsContent = swimlaneData.filter(c => c.type !== 'video');
// 🌟 Apple TV 级算法 1：按模块 (Module) 动态聚合数据
  const moduleGroups = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    swimlaneData.forEach(item => {
      // 如果没有 module，归类为综合指南
      const mod = item.module || 'General';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(item);
    });
    return groups;
  }, [swimlaneData]);

  // 🌟 Apple TV 级算法 2：为 "为你推荐" 行制造排序差异 (这里以反转顺序为例，避免和下方完全一样)
  const recommendedItems = useMemo(() => [...swimlaneData].reverse(), [swimlaneData]);
  return (
    <div className="p-8 pb-24 max-w-[1400px] mx-auto font-sans overflow-x-hidden min-h-screen">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">培训与资源中心</h1>
          <p className="text-gray-500 text-sm">探索为你量身定制的系统指南与最佳实践</p>
        </div>
        
        {/* 🌟 搜索框绑定状态 */}
        <div className="relative bg-white rounded-full shadow-sm border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all w-full md:w-auto">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="搜索课程、SOP、关键词..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-72 pl-10 pr-4 py-2.5 bg-transparent border-none text-sm outline-none rounded-full" 
          />
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse">
          <div className="w-full h-[400px] bg-gray-200 rounded-3xl mb-12"></div>
          <div className="flex gap-2 mb-8"><div className="w-20 h-8 bg-gray-200 rounded-full"></div><div className="w-24 h-8 bg-gray-200 rounded-full"></div></div>
          <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="flex gap-6"><div className="w-72 h-40 bg-gray-200 rounded-2xl"></div><div className="w-72 h-40 bg-gray-200 rounded-2xl"></div><div className="w-72 h-40 bg-gray-200 rounded-2xl"></div></div>
        </div>
      ) : (
        <>
          {/* Hero Banner (仅在默认视图显示) */}
          {featuredContent && (
            <div className="relative w-full h-[400px] rounded-3xl overflow-hidden mb-12 shadow-lg group cursor-pointer bg-slate-900">
              {featuredContent.thumbnail_url && (
                <img src={featuredContent.thumbnail_url} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-50 transition-opacity duration-500" />
              )}
              {!featuredContent.thumbnail_url && (
                 <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-indigo-900 opacity-90"></div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-900/40 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-10 w-full md:w-2/3">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">✨ 最新入库 (Latest)</span>
                  <span className="text-gray-300 text-sm font-medium flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(featuredContent.updated_at).toLocaleDateString()}</span>
                </div>
                <h2 className="text-4xl font-extrabold text-white mb-4 leading-tight group-hover:underline decoration-blue-500 underline-offset-4">{featuredContent.title}</h2>
                <p className="text-gray-300 text-base mb-6 line-clamp-2">{featuredContent.description || 'AI 暂未提取该资源的详细摘要。点击进入了解更多详情。'}</p>
                <div className="flex gap-4">
                  <Link href={`/training/${featuredContent.id}`} className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-gray-100 transition-transform active:scale-95">
                    <Play className="w-5 h-5 fill-current" /> 立即查看
                  </Link>
                  
                  {/* 🌟 Hero 区域真实的收藏按钮 */}
                  <button 
                    onClick={(e) => toggleFavorite(featuredContent.id, e)}
                    className={`backdrop-blur-md px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-colors border ${
                      favorites.includes(featuredContent.id) 
                      ? 'bg-blue-600/80 text-white border-blue-500' 
                      : 'bg-gray-800/60 text-white hover:bg-gray-700/80 border-gray-600/50'
                    }`}
                  >
                    {favorites.includes(featuredContent.id) ? (
                      <><BookmarkCheck className="w-5 h-5" /> 已收藏</>
                    ) : (
                      <><Bookmark className="w-5 h-5" /> 稍后观看</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 🌟 真实绑定的标签栏 */}
          <div className="flex gap-2 mb-8 border-b border-gray-200 pb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {['For You', '🔥 热门视频', '📄 SOP 手册', '⭐ 我的收藏'].map(tab => (
              <button 
                key={tab} 
                onClick={() => { setActiveTab(tab); setSearchTerm(''); }} // 切换 Tab 时清空搜索
                className={`px-5 py-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all ${activeTab === tab ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900'}`}
              >
                {tab}
                {/* 如果是收藏 tab，展示数量角标 */}
                {tab === '⭐ 我的收藏' && favorites.length > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab ? 'bg-white/20' : 'bg-gray-300'}`}>{favorites.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* 动态泳道渲染区 / 空状态 */}
    {/* 动态泳道渲染区 / 空状态 */}
          {filteredContents.length === 0 ? (
             <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-3xl">
               <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
               <h3 className="text-gray-900 font-bold text-lg mb-1">
                 {activeTab === '⭐ 我的收藏' ? '收藏夹为空' : '未找到相关资源'}
               </h3>
               <p className="text-gray-500 text-sm">
                 {activeTab === '⭐ 我的收藏' ? '点击卡片右上角的书签图标即可添加到这里' : '尝试更换关键词或清除过滤条件'}
               </p>
             </div>
          ) : (
            <div className="space-y-10">
              
              {/* 行 1：角色推荐（只有在主页展示） */}
              {activeTab === 'For You' && recommendedItems.length > 0 && (
                <SwimlaneRow 
                  title={
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      基于你的角色 <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-sm font-bold">Key User</span> 推荐
                    </h2>
                  }
                  items={recommendedItems.slice(0, 8)} // 最多推8个
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                />
              )}

              {/* 行 2+：像 Netflix 一样，根据系统的 Module 动态生成行 */}
              {Object.entries(moduleGroups).map(([moduleName, items]) => {
                
                // 🌟 排重逻辑：如果这个模块的数据和"推荐"一模一样，或者数量只有1个，就不单独成行了
                if (activeTab === 'For You' && items.length === recommendedItems.length) return null;

                return (
                  <SwimlaneRow 
                    key={moduleName}
                    title={
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        {moduleName === 'General' ? '🌍 综合基础知识' : `📁 ${moduleName} 业务专区`}
                      </h2>
                    }
                    items={items} 
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                  />
                );
              })}

            </div>
          )}
        </>
      )}
    </div>
  );
}

function BookOpenIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
}