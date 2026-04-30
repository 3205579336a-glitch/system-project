'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Search, Copy, Check, Star, ChevronDown, ChevronUp, Users,
  ArrowRight, ExternalLink, Link as LinkIcon, XCircle,
  ChevronLeft, ChevronRight, Lightbulb, X, Command, Loader2,Sparkles,
  Link,PlayCircle,BookOpen,FileText
} from 'lucide-react';
import Fuse from 'fuse.js';

// --- 初始化 Supabase 客户端 ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',

);

// --- 类型定义 ---
interface RelatedTCode { code: string; label: string; }
interface TCodeItem {
  id: number; code: string; desc: string; module: string; type: string;
  roles: string[]; tip: string; related: RelatedTCode[];
  keywords?: string[]; aliases?: string[]; scenario?: string[];
  priority?: string;
}

const TUTORIAL_STEPS = [
  {
    id: 1,
    title: '🎯 精准检索与过滤',
    desc: '支持中英文模糊搜索。你也可以通过上方的「适用岗位」或「业务模块」快速筛选出属于你的核心 T-code。',
    icon: Search,
    color: 'text-blue-500',
    bg: 'bg-blue-50'
  },
  {
    id: 2,
    title: '⚡ 快捷操作',
    desc: '在卡片右侧，你可以一键复制系统代码、复制分享链接发送给同事，或者点击「直达 SAP」在网页端直接打开该事务。',
    icon: Command,
    color: 'text-purple-500',
    bg: 'bg-purple-50'
  },
  {
    id: 3,
    title: '📖 深入探索详情',
    desc: '点击任意卡片即可展开详情，查看具体的业务操作提示、适用岗位说明以及关联的快捷操作。',
    icon: ChevronDown,
    color: 'text-green-500',
    bg: 'bg-green-50'
  },
  {
    id: 4,
    title: '🔗 穿透关联操作',
    desc: '在详情页中，点击「关联操作」可以快速跳转到相关的 T-code 指南。如果系统未收录该指南，也会引导你直接前往 SAP。',
    icon: ArrowRight,
    color: 'text-orange-500',
    bg: 'bg-orange-50'
  }
];

function TCodeDirectoryCore() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // 🌟 新增：云端数据状态
  const [tcodeData, setTcodeData] = useState<TCodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [learningData, setLearningData] = useState<any[]>([]); // <-- 新增：全量培训资源
  const [suggestedLearning, setSuggestedLearning] = useState<any[]>([]); // <-- 新增：当前推荐的培训资源

  // 🌟 AI 搜索专属状态
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiMatchedCodes, setAiMatchedCodes] = useState<string[] | null>(null);

  // 初始化状态
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('cat') || 'All');
  const [activeRole, setActiveRole] = useState(searchParams.get('role') || 'All Roles');
  const [expandedId, setExpandedId] = useState<number | null>(searchParams.get('expand') ? Number(searchParams.get('expand')) : null);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const ITEMS_PER_PAGE = 10;

// 🌟 初始化为空数组
  const [favorites, setFavorites] = useState<number[]>([]);


  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [linkCopiedId, setLinkCopiedId] = useState<number | null>(null);

  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);


  // 🌟 1. 预设你希望轮播的动态占位符数组
const PLACEHOLDERS = [
    "输入业务场景，例如：怎么创建采购订单？",
    "反查 T-code 用途？直接输入 ME21N 或 MIGO 试试...",
    "模糊查询业务，例如：发票校验、库存盘点、交货冻结...",
    "寻找特定 SAP 报表？例如：查询物料凭证清单...",
    "按系统模块搜索，例如输入：MM, FICO, SD..."
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // 🌟 3. 使用 useEffect 设置定时器，每 3.5 秒切换一次
  useEffect(() => {
    const intervalId = setInterval(() => {
      setPlaceholderIndex((prevIndex) => (prevIndex + 1) % PLACEHOLDERS.length);
    }, 3500); // 3500毫秒 = 3.5秒

    // 清理定时器，防止内存泄漏
    return () => clearInterval(intervalId);
  }, []);
    // 🌟 组件挂载后，从本地存储读取收藏记录
  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem('tcode_favorites');
      if (savedFavs) {
        setFavorites(JSON.parse(savedFavs));
      }
    } catch (error) {
      console.error('读取收藏数据失败:', error);
    }
  }, []);
  // 🌟 从 Supabase 同时获取 T-code 和 培训资源数据
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      // 并行请求两个表，提升加载速度
      const [tcodesRes, learningRes] = await Promise.all([
        supabase.from('tcodes').select('*').order('id', { ascending: true }),
        supabase.from('learning_contents').select('*').order('updated_at', { ascending: false })
      ]);

      if (tcodesRes.data) setTcodeData(tcodesRes.data as TCodeItem[]);
      if (learningRes.data) setLearningData(learningRes.data);
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const fuse = useMemo(() => {
    return new Fuse(tcodeData, {
      keys: [
        { name: 'code', weight: 0.3 },        // 降低权重
        { name: 'desc', weight: 0.2 },
        { name: 'keywords', weight: 0.25 },   // ⭐ 核心
        { name: 'aliases', weight: 0.15 },    // ⭐ 用户语言
        { name: 'scenario', weight: 0.1 },    // ⭐ 长语义
      ],
      threshold: 0.35,        // 👉 放宽一点（支持模糊）
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 2,
    });
  }, [tcodeData]);


  // 🌟 从 Supabase 获取数据
  useEffect(() => {
    const fetchTCodes = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tcodes')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Failed to fetch T-codes:', error);
      } else if (data) {
        setTcodeData(data as TCodeItem[]);
      }
      setIsLoading(false);
    };

    fetchTCodes();
  }, []);

  // 🌟 动态计算分类和角色 (确保数据加载完成后推导)
  const CATEGORIES = useMemo(() => {
    return ['All', 'Favorites', ...Array.from(new Set(tcodeData.map(item => item.module)))];
  }, [tcodeData]);

  const ROLES = useMemo(() => {
    return ['All Roles', ...Array.from(new Set(tcodeData.flatMap(item => item.roles)))];
  }, [tcodeData]);

  const maintainedCodes = useMemo(() => {
    return tcodeData.map(t => t.code.toUpperCase());
  }, [tcodeData]);

  // 同步 URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    if (activeCategory !== 'All') params.set('cat', activeCategory);
    if (activeRole !== 'All Roles') params.set('role', activeRole);
    if (expandedId) params.set('expand', expandedId.toString());
    if (currentPage > 1) params.set('page', currentPage.toString());

    const newUrl = `${pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [searchTerm, activeCategory, activeRole, expandedId, currentPage, pathname]);

// 🌟 AI 核心调用方法
// 🌟 增强版 AI 核心调用方法
// 🌟 增强版 AI 核心调用方法
  const handleAiSearch = async () => {
    if (!searchTerm.trim() || isAiSearching) return;
    
    setIsAiSearching(true);
    setAiMatchedCodes(null);
    setSuggestedLearning([]); // 清空旧的文档推荐

    try {
      // 1. 压缩 T-code 目录数据以节省大模型 Token
      const compressedTCodes = tcodeData.map(t => ({
        c: t.code, d: t.desc, k: t.keywords?.join(','), a: t.aliases?.join(','), s: t.scenario?.join(',')
      }));

      // 2. 压缩 培训资源 目录数据以节省大模型 Token
      const compressedLearnings = learningData.map(l => ({
        id: l.id, t: l.title, d: l.description, m: l.module
      }));

      console.log('[AI Search] Sending query to AI backend with compressed catalogs:', { searchTerm, compressedTCodes, compressedLearnings });

      // 发送请求，把两种数据都传给 AI 后端
      const res = await fetch('/api/ai/search-tcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchTerm, 
          tcodeCatalog: compressedTCodes,
          learningCatalog: compressedLearnings
        })
      });

      const resData = await res.json();
      
      if (resData.success && resData.data) {
        // ✨ 设置大模型匹配到的 T-code
        if (Array.isArray(resData.data.tcodes)) {
          setAiMatchedCodes(resData.data.tcodes);
          setCurrentPage(1);
        }

        // ✨ 设置大模型匹配到的 培训资源 (根据返回的 ID 过滤出完整的资源对象)
        if (Array.isArray(resData.data.learningIds) && resData.data.learningIds.length > 0) {
          const matchedDocs = learningData.filter(doc => resData.data.learningIds.includes(doc.id));
          setSuggestedLearning(matchedDocs);
        }
      }
    } catch (error) {
      console.error('AI 匹配失败', error);
      alert('AI 引擎暂时开小差了，请稍后再试。');
    } finally {
      setIsAiSearching(false);
    }
  };
  // 监听回车键触发 AI 搜索
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAiSearch();
  };

  // 过滤逻辑 (双引擎降级)
// 过滤逻辑 (双引擎降级)
  const filteredTCodes = useMemo(() => {
    let baseResult = tcodeData;

    if (activeRole !== 'All Roles') baseResult = baseResult.filter(t => t.roles.includes(activeRole));
    if (activeCategory === 'Favorites') baseResult = baseResult.filter(t => favorites.includes(t.id));
    else if (activeCategory !== 'All') baseResult = baseResult.filter(t => t.module === activeCategory);

    if (!searchTerm.trim()) return baseResult;

    // ⭐ 引擎 1：如果大模型返回了结果，强制使用大模型的结果！
    if (aiMatchedCodes !== null) {
      return baseResult.filter(t => aiMatchedCodes.includes(t.code));
    }

    // ⭐ 引擎 2：如果大模型还没介入，使用原生的 Fuse 实时模糊搜索
    fuse.setCollection(baseResult);
    return fuse.search(searchTerm)
      .sort((a, b) => {
        const scoreDiff = a.score! - b.score!;
        const priorityBoost = (item: any) => item.priority === 'High' ? -0.05 : 0;
        return scoreDiff + priorityBoost(a.item) - priorityBoost(b.item);
      })
      .map(r => r.item);

  }, [tcodeData, searchTerm, activeCategory, activeRole, favorites, fuse, aiMatchedCodes]);

  // 计算分页数据
  const totalPages = Math.ceil(filteredTCodes.length / ITEMS_PER_PAGE);
  const paginatedTCodes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTCodes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTCodes, currentPage]);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const handleSearchChange = (val: string) => { 
    setSearchTerm(val); 
    setCurrentPage(1); 
    
    // 🐛 修复：当搜索词清空时，彻底重置 AI 状态和推荐资源
    if (!val.trim()) {
      setAiMatchedCodes(null);
      setSuggestedLearning([]);
    }
  };
  const handleCategoryChange = (val: string) => { setActiveCategory(val); setCurrentPage(1); };
  const handleRoleChange = (val: string) => { setActiveRole(val); setCurrentPage(1); };

  // 🔗 复制纯净直达链接
  const handleCopyLink = (e: React.MouseEvent, tcode: TCodeItem) => {
    e.preventDefault();
    e.stopPropagation();
    // 只保留纯净 URL，包含搜索词和展开 ID
    const cleanUrl = `${window.location.origin}${pathname}?q=${tcode.code}&expand=${tcode.id}`;
    navigator.clipboard.writeText(cleanUrl);
    setLinkCopiedId(tcode.id);
    setTimeout(() => setLinkCopiedId(null), 2000);
  };

  // 📝 复制分享卡片 (富文本)
  const handleCopy = (e: React.MouseEvent, tcode: TCodeItem) => {
    e.preventDefault();
    e.stopPropagation();
    const cleanUrl = `${window.location.origin}${pathname}?q=${tcode.code}&expand=${tcode.id}`;
    const shareText = `📌 SAP T-code: ${tcode.code}\n📖 业务说明: ${tcode.desc}\n🔗 直达指南: ${cleanUrl}`;

    navigator.clipboard.writeText(shareText);
    setCopiedId(tcode.id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const handleLaunchSAP = (e: React.MouseEvent, code: string) => { e.preventDefault(); e.stopPropagation(); const launchUrl = `https://ui5ce.volvo.com/sap/bc/gui/sap/its/webgui?~transaction=${code}`; window.open(launchUrl, '_blank'); };
 const toggleFavorite = (e: React.MouseEvent, id: number) => { 
    e.stopPropagation(); 
    setFavorites(prev => {
      // 1. 计算最新的收藏数组
      const newFavorites = prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id];
      
      // 2. 同步保存到浏览器的 localStorage 中
      try {
        localStorage.setItem('tcode_favorites', JSON.stringify(newFavorites));
      } catch (error) {
        console.error('保存收藏数据失败:', error);
      }
      
      return newFavorites;
    }); 
  };
  const toggleExpand = (id: number) => { const selection = window.getSelection(); if (selection && selection.toString().length > 0) return; setExpandedId(prev => prev === id ? null : id); };

const handleRelatedClick = (e: React.MouseEvent, targetCode: string) => {
    e.stopPropagation();
    const isMaintained = maintainedCodes.includes(targetCode.toUpperCase());
    if (isMaintained) {
      handleSearchChange(targetCode);
      handleCategoryChange('All');
      handleRoleChange('All Roles');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // 💡 在这里加上 Google 访问的提示
      const confirmLaunch = window.confirm(`暂未收录【${targetCode}】的详细操作指南。\n\n是否直接在 SAP 系统中打开该 T-code？\n(💡 提示：如果需要直达 SAP，需要在 Google 上访问)`);
      if (confirmLaunch) {
        window.open(`https://ui5ce.volvo.com/sap/bc/gui/sap/its/webgui?~transaction=${targetCode}`, '_blank');
      }
    }
  };

  const nextStep = () => setTutorialStep(prev => Math.min(prev + 1, TUTORIAL_STEPS.length - 1));
  const prevStep = () => setTutorialStep(prev => Math.max(prev - 1, 0));
  const closeTutorial = () => { setIsTutorialOpen(false); setTimeout(() => setTutorialStep(0), 300); };

  return (
    <div className="p-8 pb-20">
      <div className="max-w-4xl mx-auto mt-8">

     {/* 头部与过滤区 */}
        <div className="flex flex-wrap gap-4 justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">T-code 检索台</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-gray-500 text-sm">找到属于你角色的核心操作指南</p>
              
              {/* 🌟 新增：精美的环境要求提示标签 */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/80 text-blue-600 rounded-lg text-xs font-medium border border-blue-100/50">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>使用直达 SAP 功能需基于 Google 浏览器</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setIsTutorialOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full font-medium transition-all shadow-sm hover:shadow-md border border-blue-100 shrink-0"
          >
            <Lightbulb className="w-4 h-4 fill-blue-600" />
            使用秘籍
          </button>
        </div>

      {/* 🌟 升级版搜索栏 */}
        <div className="bg-white p-3 rounded-3xl shadow-sm mb-6 border border-slate-200/60 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            
            <div className="relative flex-grow bg-slate-50/50 rounded-2xl border border-transparent focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 transition-all flex items-center">
              <div className="pl-4 pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder={PLACEHOLDERS[placeholderIndex]}
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-3 pr-40 py-4 bg-transparent border-none focus:ring-0 text-[15px] font-medium outline-none text-slate-700 placeholder:text-slate-400"
              />
              
              {/* 内部绝对定位的操作区 */}
              <div className="absolute right-2 flex items-center gap-1">
                {searchTerm && (
                  <button onClick={() => handleSearchChange('')} className="p-2 text-slate-300 hover:text-slate-500 transition-colors">
                    <XCircle className="w-5 h-5 fill-slate-100" />
                  </button>
                )}
                
                {/* ✨ 核心：AI 智能检索按钮 */}
                <button
                  onClick={handleAiSearch}
                  disabled={!searchTerm.trim() || isAiSearching}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isAiSearching 
                      ? 'bg-blue-100 text-blue-600 cursor-wait' 
                      : 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                >
                  {isAiSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-blue-300" />}
                  {isAiSearching ? '神经分析中...' : '智能匹配'}
                </button>
              </div>
            </div>

            <div className="relative flex-shrink-0 flex items-center bg-slate-50/50 border border-slate-200/60 rounded-2xl px-4 hover:border-slate-300 transition-colors">
              <Users className="w-4 h-4 text-slate-400 mr-2" />
              <select
                value={activeRole}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={isLoading}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 py-4 pr-6 outline-none cursor-pointer appearance-none disabled:opacity-50"
              >
                {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
              <div className="absolute right-4 pointer-events-none text-slate-400"><ChevronDown className="w-4 h-4" /></div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide px-1">
            {isLoading ? (
              <div className="h-9 w-64 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              CATEGORIES.map(cat => (
                <button key={cat} onClick={() => handleCategoryChange(cat)} className={`whitespace-nowrap px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${activeCategory === cat ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
                  {cat === 'Favorites' ? '⭐ 收藏' : cat}
                </button>
              ))
            )}
          </div>
        </div>

        {/* 🌟 AI 结果状态提示 (增强用户体验) */}
     {/* ✅✅✅ 把 AI横幅和推荐模块 粘贴到这里（卡片列表的上方） ✅✅✅ */}
        {/* 🌟 AI 结果状态与智能推荐区 (增强交互) */}
        {aiMatchedCodes !== null && (
          <div className="mb-6 space-y-3">
            {/* 提示横幅 */}
            <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3 text-sm text-blue-800 animate-[fadeIn_0.3s_ease-out]">
              <div className="p-1.5 bg-blue-600 rounded-lg"><Sparkles className="w-4 h-4 text-white" /></div>
              <p>基于 Qwen 大模型语义分析，为您找到以下 <b>{filteredTCodes.length}</b> 个高度相关的业务代码。</p>
            </div>

            {/* ✨ 新增：培训与资源智能推荐 */}
            {suggestedLearning.length > 0 && (
              <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm animate-[fadeIn_0.4s_ease-out]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-bold text-indigo-900">💡 猜您需要相关的操作指南与 SOP</h3>
                  </div>
                  <Link href="/training" className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 font-medium">
                    前往培训中心 <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {suggestedLearning.map(doc => (
                    <Link 
                      key={doc.id} 
                      href={`/training/${doc.id}`} 
                      target="_blank" 
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-indigo-50/60 border border-transparent hover:border-indigo-100 transition-all group"
                    >
                      <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-200 group-hover:text-indigo-700 transition-colors">
                        {doc.type === 'video' ? <PlayCircle className="w-5 h-5 text-indigo-500" /> : <FileText className="w-5 h-5 text-indigo-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{doc.title}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{doc.module || '综合指南'} • {doc.type === 'video' ? '视频教程' : '文档指南'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 卡片列表 */}
        <div className="space-y-4 relative min-h-[400px]">
          {isLoading ? (
            // 优雅的骨架屏动画
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-6 h-6 rounded-full bg-gray-100" />
                  <div className="space-y-2 flex-1 max-w-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-24 bg-gray-200 rounded-md" />
                      <div className="h-5 w-16 bg-gray-100 rounded-full" />
                    </div>
                    <div className="h-4 w-48 bg-gray-100 rounded-md" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 bg-gray-100 rounded-xl" />
                  <div className="h-10 w-24 bg-gray-100 rounded-xl" />
                  <div className="h-10 w-32 bg-gray-200 rounded-xl" />
                </div>
              </div>
            ))
          ) : paginatedTCodes.length > 0 ? (
            paginatedTCodes.map((tcode) => (
            <div key={tcode.id} onClick={() => toggleExpand(tcode.id)} className={`bg-white border rounded-2xl relative transition-all duration-300 cursor-pointer hover:border-blue-300 hover:shadow-md hover:z-20 ${expandedId === tcode.id ? 'ring-2 ring-blue-100 border-blue-200 z-20' : 'border-gray-200 z-10'}`}>
                <div className="p-5 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <button onClick={(e) => toggleFavorite(e, tcode.id)} className={`transition-colors ${favorites.includes(tcode.id) ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}>
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-xl text-gray-900 font-mono tracking-tight">{tcode.code}</span>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${tcode.type === 'Action' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{tcode.type}</span>
                      </div>
                      <span className="text-gray-500 text-sm">{tcode.desc}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 1. 链接按钮：只传纯净 URL */}
                    <button onClick={(e) => handleCopyLink(e, tcode)} title="复制直达链接" className="p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200">
                      {linkCopiedId === tcode.id ? <Check className="h-4 w-4 text-green-600" /> : <LinkIcon className="h-4 w-4" />}
                    </button>

                    {/* 2. Copy按钮：复制富文本卡片 */}
                   {/* 2. Copy按钮：复制富文本卡片 */}
                    <button onClick={(e) => handleCopy(e, tcode)} className={`px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 font-medium ${copiedId === tcode.id ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'}`}>
                      {copiedId === tcode.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedId === tcode.id ? '已复制' : '复制分享'}
                    </button>

                    {/* 3. 🌟 修改这里：为「直达 SAP」按钮增加悬浮提示 */}
                    <div className="relative group flex items-center">
                      <button onClick={(e) => handleLaunchSAP(e, tcode.code)} className="px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 font-medium bg-[#005A9E] text-white hover:bg-[#004378] shadow-sm hover:shadow-md border border-transparent">
                        <ExternalLink className="h-4 w-4" />
                        直达 SAP
                      </button>
                      
                      {/* CSS 驱动的极简 Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap shadow-lg translate-y-1 group-hover:translate-y-0 z-50">
                        如果需要直达 SAP，需要在 Google 上访问
                        {/* 底部小三角 */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                      </div>
                    </div>

                    <div className="text-gray-400 ml-1">
                      {expandedId === tcode.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                <div className={`bg-[#FAFCFF] border-t border-blue-50 px-5 transition-all duration-300 ease-in-out overflow-hidden ${expandedId === tcode.id ? 'max-h-[500px] py-4 opacity-100' : 'max-h-0 py-0 opacity-0'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-500">适用角色：</span>
                    {tcode.roles.map(r => <span key={r} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase">{r}</span>)}
                  </div>
                  <p className="text-sm text-blue-900 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50 mb-4 leading-relaxed">{tcode.tip}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">快捷穿透 (关联操作):</span>
                    <div className="flex gap-2 flex-wrap">
                      {tcode.related.map(rel => {
                        const isMaintained = maintainedCodes.includes(rel.code.toUpperCase());
                        return (
                          <button
                            key={rel.code}
                            onClick={(e) => handleRelatedClick(e, rel.code)}
                            className={`group flex items-center gap-1.5 text-xs bg-white border px-3 py-1.5 rounded-lg shadow-sm transition-all ${isMaintained
                              ? 'border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-600'
                              : 'border-dashed border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 hover:bg-gray-50'
                              }`}
                            title={isMaintained ? "点击查看详细指南" : "无指南，点击直达 SAP"}
                          >
                            <span className={`font-mono font-bold ${!isMaintained ? 'opacity-80' : ''}`}>{rel.code}</span>
                            <span className={`${isMaintained ? 'text-gray-400 group-hover:text-blue-400' : 'text-gray-400 group-hover:text-gray-600'}`}>
                              ({rel.label})
                            </span>
                            {isMaintained ? (
                              <ArrowRight className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all text-blue-500" />
                            ) : (
                              <ExternalLink className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all text-gray-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">没有找到相关代码</p>
              <button onClick={() => { handleSearchChange(''); handleCategoryChange('All'); handleRoleChange('All Roles'); }} className="mt-2 text-sm text-blue-500 hover:underline">
                清除所有过滤条件
              </button>
            </div>
          )}
        </div>

        {/* 分页组件 */}
        {!isLoading && totalPages > 1 && (
          <div className="mt-8 bg-white px-6 py-4 flex items-center justify-between border border-gray-100 rounded-2xl shadow-sm">
            <div className="hidden sm:block">
              <p className="text-sm text-gray-600">
                显示第 <span className="font-semibold text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> 到{' '}
                <span className="font-semibold text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredTCodes.length)}</span> 条，
                共 <span className="font-semibold text-gray-900">{filteredTCodes.length}</span> 条结果
              </p>
            </div>

            <div className="flex-1 flex justify-between sm:justify-end items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一页
              </button>

              <div className="hidden md:flex items-center gap-1">
                {getPageNumbers().map((pageNum, idx) => (
                  pageNum === '...' ? (
                    <span key={`dots-${idx}`} className="px-3 py-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum as number)}
                      className={`relative inline-flex items-center px-3.5 py-2 text-sm font-medium rounded-xl transition-all ${currentPage === pageNum
                        ? 'bg-gray-900 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      {pageNum}
                    </button>
                  )
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                下一页
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {isTutorialOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative animate-[fadeIn_0.3s_ease-out]">
              <div className="flex h-1.5 bg-gray-100 w-full">
                {TUTORIAL_STEPS.map((_, idx) => (
                  <div key={idx} className={`flex-1 transition-all duration-300 ${idx <= tutorialStep ? 'bg-blue-500' : 'bg-transparent'}`} />
                ))}
              </div>

              <button onClick={closeTutorial} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10">
                <X className="w-5 h-5" />
              </button>

              <div className="p-8">
                <div className="mb-8">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 transform ${TUTORIAL_STEPS[tutorialStep].bg} ${TUTORIAL_STEPS[tutorialStep].color}`}>
                    {(() => {
                      const Icon = TUTORIAL_STEPS[tutorialStep].icon;
                      return <Icon className="w-8 h-8" />;
                    })()}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-3 transition-opacity">
                    {TUTORIAL_STEPS[tutorialStep].title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed min-h-[4.5rem]">
                    {TUTORIAL_STEPS[tutorialStep].desc}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex gap-1.5">
                    {TUTORIAL_STEPS.map((_, idx) => (
                      <div key={idx} className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === tutorialStep ? 'bg-blue-500 w-4' : 'bg-gray-200'}`} />
                    ))}
                  </div>

                  <div className="flex gap-3">
                    {tutorialStep > 0 && (
                      <button onClick={prevStep} className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 font-medium transition-colors">
                        上一步
                      </button>
                    )}

                    {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                      <button onClick={nextStep} className="px-5 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-medium transition-colors shadow-sm">
                        下一步
                      </button>
                    ) : (
                      <button onClick={closeTutorial} className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors shadow-md shadow-blue-500/20 flex items-center gap-2">
                        开始使用
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function TCodeDirectoryProMax() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center text-gray-400">加载中...</div>}>
      <TCodeDirectoryCore />
    </Suspense>
  );
}