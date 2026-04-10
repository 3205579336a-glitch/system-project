'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { 
  Search, Copy, Check, Star, ChevronDown, ChevronUp, Users, 
  ArrowRight, ExternalLink, Link as LinkIcon, XCircle, 
  ChevronLeft, ChevronRight, Lightbulb, X, Command
} from 'lucide-react';
import TCODE_DATA from './data.json';

// 自动生成分类和角色下拉菜单
const CATEGORIES = ['All', 'Favorites', ...Array.from(new Set(TCODE_DATA.map(item => item.module)))];
const ROLES = ['All Roles', ...Array.from(new Set(TCODE_DATA.flatMap(item => item.roles)))];


// 🌟 新增：教程步骤数据
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

  // 1. 初始化状态
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('cat') || 'All');
  const [activeRole, setActiveRole] = useState(searchParams.get('role') || 'All Roles');
  const [expandedId, setExpandedId] = useState<number | null>(searchParams.get('expand') ? Number(searchParams.get('expand')) : null);
  
  // 🌟 新增：分页状态与常量
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const ITEMS_PER_PAGE = 10; // 每页显示数量，可随时调整

  const [favorites, setFavorites] = useState<number[]>([1, 5]); 
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [linkCopiedId, setLinkCopiedId] = useState<number | null>(null);

  // 🌟 新增：新手引导状态
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const maintainedCodes = useMemo(() => {
    return TCODE_DATA.map(t => t.code.toUpperCase());
  }, []);

  // 2. 深度链接魔法：同步 URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    if (activeCategory !== 'All') params.set('cat', activeCategory);
    if (activeRole !== 'All Roles') params.set('role', activeRole);
    if (expandedId) params.set('expand', expandedId.toString());
    if (currentPage > 1) params.set('page', currentPage.toString()); // 🌟 记录页码

    const newUrl = `${pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [searchTerm, activeCategory, activeRole, expandedId, currentPage, pathname]);

  // 3. 过滤逻辑
  const filteredTCodes = useMemo(() => {
    let result = TCODE_DATA;
    if (activeRole !== 'All Roles') result = result.filter(t => t.roles.includes(activeRole));
    if (activeCategory === 'Favorites') result = result.filter(t => favorites.includes(t.id));
    else if (activeCategory !== 'All') result = result.filter(t => t.module === activeCategory);
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(t => t.code.toLowerCase().includes(lowerTerm) || t.desc.toLowerCase().includes(lowerTerm));
    }
    return result;
  }, [searchTerm, activeCategory, activeRole, favorites]);

  // 🌟 新增：计算分页数据
  const totalPages = Math.ceil(filteredTCodes.length / ITEMS_PER_PAGE);
  const paginatedTCodes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTCodes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTCodes, currentPage]);

  // 🌟 新增：生成智能页码数组 (如: 1, 2, ..., 5, 6, 7, ..., 10)
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

  // 🌟 过滤器改变时，重置回第一页的包装函数
  const handleSearchChange = (val: string) => { setSearchTerm(val); setCurrentPage(1); };
  const handleCategoryChange = (val: string) => { setActiveCategory(val); setCurrentPage(1); };
  const handleRoleChange = (val: string) => { setActiveRole(val); setCurrentPage(1); };

  // --- 现有的操作处理函数保持不变 ---
  const handleCopy = (e: React.MouseEvent, code: string, id: number) => { /* ... */ e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(code); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
  const handleCopyLink = (e: React.MouseEvent, id: number) => { /* ... */ e.preventDefault(); e.stopPropagation(); const currentUrl = window.location.href; navigator.clipboard.writeText(currentUrl); setLinkCopiedId(id); setTimeout(() => setLinkCopiedId(null), 2000); };
  const handleLaunchSAP = (e: React.MouseEvent, code: string) => { /* ... */ e.preventDefault(); e.stopPropagation(); const launchUrl = `https://ui5ce.volvo.com/sap/bc/gui/sap/its/webgui?~transaction=${code}`; window.open(launchUrl, '_blank'); };
  const toggleFavorite = (e: React.MouseEvent, id: number) => { e.stopPropagation(); setFavorites(prev => prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]); };
  const toggleExpand = (id: number) => { const selection = window.getSelection(); if (selection && selection.toString().length > 0) return; setExpandedId(prev => prev === id ? null : id); };
  
  const handleRelatedClick = (e: React.MouseEvent, targetCode: string) => {
    e.stopPropagation();
    const isMaintained = maintainedCodes.includes(targetCode.toUpperCase());
    if (isMaintained) {
      handleSearchChange(targetCode); // 🌟 使用带重置页码的搜索
      handleCategoryChange('All'); 
      handleRoleChange('All Roles'); 
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
    } else {
      const confirmLaunch = window.confirm(`暂未收录【${targetCode}】的详细操作指南。\n\n是否直接在 SAP 系统中打开该 T-code？`);
      if (confirmLaunch) {
        window.open(`https://ui5ce.volvo.com/sap/bc/gui/sap/its/webgui?~transaction=${targetCode}`, '_blank');
      }
    }
  };

  // 🌟 新增：教程控制逻辑
  const nextStep = () => setTutorialStep(prev => Math.min(prev + 1, TUTORIAL_STEPS.length - 1));
  const prevStep = () => setTutorialStep(prev => Math.max(prev - 1, 0));
  const closeTutorial = () => { setIsTutorialOpen(false); setTimeout(() => setTutorialStep(0), 300); };

  return (
    <div className="p-8 pb-20">
      <div className="max-w-4xl mx-auto mt-8">
        
        {/* 头部与过滤区 */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">T-code 检索台</h1>
            <p className="text-gray-500 text-sm">找到属于你角色的核心操作指南</p>
          </div>
          {/* 🌟 新增：右上角教学按钮 */}
          <button 
            onClick={() => setIsTutorialOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full font-medium transition-all shadow-sm hover:shadow-md border border-blue-100"
          >
            <Lightbulb className="w-4 h-4 fill-blue-600" />
            使用秘籍
          </button>
        </div>

        <div className="bg-white p-3 rounded-2xl shadow-sm mb-6 border border-gray-100 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow bg-gray-50 rounded-xl border border-transparent focus-within:border-blue-200 focus-within:bg-white transition-all">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="text" 
                autoFocus 
                placeholder="搜索代码或业务描述..." 
                value={searchTerm} 
                onChange={(e) => handleSearchChange(e.target.value)} // 🌟 使用新函数
                className="w-full pl-11 pr-12 py-3 bg-transparent border-none focus:ring-0 text-lg outline-none" 
              />
              {searchTerm && (
                <button
                  onClick={() => handleSearchChange('')} // 🌟 使用新函数
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="w-5 h-5 fill-gray-200 text-gray-500 hover:fill-gray-300 hover:text-gray-600 transition-all" />
                </button>
              )}
            </div>
            <div className="relative flex-shrink-0 flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3">
              <Users className="w-4 h-4 text-gray-500 mr-2" />
              <select value={activeRole} onChange={(e) => handleRoleChange(e.target.value)} className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 py-3 pr-8 outline-none cursor-pointer appearance-none">
                {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
              <div className="absolute right-3 pointer-events-none text-gray-400"><ChevronDown className="w-4 h-4" /></div>
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => handleCategoryChange(cat)} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeCategory === cat ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                {cat === 'Favorites' ? '⭐ 收藏' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* 卡片列表 */}
        <div className="space-y-4">
          {paginatedTCodes.length > 0 ? ( // 🌟 渲染 paginatedTCodes 而不是 filteredTCodes
            paginatedTCodes.map((tcode) => (
              <div key={tcode.id} onClick={() => toggleExpand(tcode.id)} className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer hover:border-blue-300 hover:shadow-md ${expandedId === tcode.id ? 'ring-2 ring-blue-100 border-blue-200' : 'border-gray-200'}`}>
                {/* --- 你的卡片内部代码保持原样 --- */}
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
                    <button onClick={(e) => handleCopyLink(e, tcode.id)} title="复制分享链接" className="p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200">
                      {linkCopiedId === tcode.id ? <Check className="h-4 w-4 text-green-600" /> : <LinkIcon className="h-4 w-4" />}
                    </button>
                    <button onClick={(e) => handleCopy(e, tcode.code, tcode.id)} className={`px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 font-medium ${copiedId === tcode.id ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'}`}>
                      {copiedId === tcode.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedId === tcode.id ? '已复制' : 'Copy'}
                    </button>
                    
                    <button onClick={(e) => handleLaunchSAP(e, tcode.code)} className="px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 font-medium bg-[#005A9E] text-white hover:bg-[#004378] shadow-sm hover:shadow-md border border-transparent">
                      <ExternalLink className="h-4 w-4" />
                      直达 SAP
                    </button>

                    <div className="text-gray-400 ml-1">
                      {expandedId === tcode.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                <div className={`bg-[#FAFCFF] border-t border-blue-50 px-5 transition-all duration-300 ease-in-out overflow-hidden ${expandedId === tcode.id ? 'max-h-[500px] py-4 opacity-100' : 'max-h-0 py-0 opacity-0'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-500">适用岗位：</span>
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
                            className={`group flex items-center gap-1.5 text-xs bg-white border px-3 py-1.5 rounded-lg shadow-sm transition-all ${
                              isMaintained 
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
                {/* --- 卡片内部代码结束 --- */}
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">没有找到相关代码</p>
              <button onClick={() => {handleSearchChange(''); handleCategoryChange('All'); handleRoleChange('All Roles');}} className="mt-2 text-sm text-blue-500 hover:underline">
                清除所有过滤条件
              </button>
            </div>
          )}
        </div>

        {/* 🌟 漂亮的分页组件区域 */}
        {totalPages > 1 && (
          <div className="mt-8 bg-white px-6 py-4 flex items-center justify-between border border-gray-100 rounded-2xl shadow-sm">
            {/* 左侧：数据状态描述 */}
            <div className="hidden sm:block">
              <p className="text-sm text-gray-600">
                显示第 <span className="font-semibold text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> 到{' '}
                <span className="font-semibold text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredTCodes.length)}</span> 条，
                共 <span className="font-semibold text-gray-900">{filteredTCodes.length}</span> 条结果
              </p>
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex-1 flex justify-between sm:justify-end items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一页
              </button>
              
              {/* 页码数字按钮 */}
              <div className="hidden md:flex items-center gap-1">
                {getPageNumbers().map((pageNum, idx) => (
                  pageNum === '...' ? (
                    <span key={`dots-${idx}`} className="px-3 py-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum as number)}
                      className={`relative inline-flex items-center px-3.5 py-2 text-sm font-medium rounded-xl transition-all ${
                        currentPage === pageNum 
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
          {/* 动画入场容器 */}
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative animate-[fadeIn_0.3s_ease-out]">
            
            {/* 顶部进度条 */}
            <div className="flex h-1.5 bg-gray-100 w-full">
              {TUTORIAL_STEPS.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`flex-1 transition-all duration-300 ${idx <= tutorialStep ? 'bg-blue-500' : 'bg-transparent'}`} 
                />
              ))}
            </div>

            {/* 关闭按钮 */}
            <button onClick={closeTutorial} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10">
              <X className="w-5 h-5" />
            </button>

            {/* 内容区 */}
            <div className="p-8">
              <div className="mb-8">
                {/* 动态图标 */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 transform ${TUTORIAL_STEPS[tutorialStep].bg} ${TUTORIAL_STEPS[tutorialStep].color}`}>
                  {(() => {
                    const Icon = TUTORIAL_STEPS[tutorialStep].icon;
                    return <Icon className="w-8 h-8" />;
                  })()}
                </div>
                
                {/* 标题与描述 */}
                <h3 className="text-xl font-bold text-gray-900 mb-3 transition-opacity">
                  {TUTORIAL_STEPS[tutorialStep].title}
                </h3>
                <p className="text-gray-500 leading-relaxed min-h-[4.5rem]">
                  {TUTORIAL_STEPS[tutorialStep].desc}
                </p>
              </div>

              {/* 底部操作区 */}
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

// --- 根组件包裹 Suspense ---
export default function TCodeDirectoryProMax() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center text-gray-400">加载中...</div>}>
      <TCodeDirectoryCore />
    </Suspense>
  );
}