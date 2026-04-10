'use client';

import { useState, useRef, useEffect } from 'react'; // 🌟 新增 useEffect
import Link from 'next/link';
import { Search, Play, FileText, Clock, TrendingUp, Star, ChevronRight, ChevronLeft, PlayCircle, Bookmark } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

// 共享的模拟数据
export const MOCK_CONTENT = [
  {
    id: "learn_008",
    type: "video",
    title: "如何注册 IT Case",
    module: "System Improvement",
    role: "Key User",
    thumb: "from-blue-500 to-indigo-600",
    views: "1.2k",
    rating: "98%",
    duration: "15:20",
    url: "https://volvogroup.sharepoint.com/sites/unit-uattest/_layouts/15/embed.aspx?UniqueId=c3ff61a1-7f0f-43f6-90de-523ff7dc19d4&embed=%7B%22ust%22%3Atrue%7D&referrer=StreamWebApp&referrerScenario=EmbedDialog.Create",
    // 👇 新增字段：简介、作者、更新日期、相关标签
    description: "本视频详细讲解了当系统出现故障或需要权限申请时，如何通过标准的 IT Portal 提交一个符合规范的 IT Case。课程涵盖了必填字段说明、SLA 响应时间以及如何追踪 Case 进度。",
    author: "IT Support Team",
    updatedAt: "2025-10-20",
    tags: ["IT Portal", "Support", "Ticketing"]
  },
  {
    id: "learn_001",
    type: "video",
    title: "如何注册 IT Case",
    module: "System Improvement",
    role: "Key User",
    thumb: "from-blue-500 to-indigo-600",
    views: "1.2k",
    rating: "98%",
    duration: "15:20",
    // 👇 加上这行你刚才清洗好的链接
    url: "https://volvogroup.sharepoint.com/sites/unit-uattest/_layouts/15/embed.aspx?UniqueId=c3ff61a1-7f0f-43f6-90de-523ff7dc19d4&embed=%7B%22ust%22%3Atrue%7D&referrer=StreamWebApp&referrerScenario=EmbedDialog.Create"
  },
  {
    id: "learn_002",
    type: "video",
    title: "如何申请SAP role",
    module: "System Improvement",
    role: "Key User",
    thumb: "from-blue-500 to-indigo-600",
    views: "0.2k",
    rating: "98%",
    duration: "1:30:59",
    // 👇 加上这行你刚才清洗好的链接
    url: "https://volvogroup.sharepoint.com/sites/unit-uattest/_layouts/15/embed.aspx?UniqueId=df55f9bd-e9db-44e7-8003-dc8715d38fb8&embed=%7B%22ust%22%3Atrue%2C%22hv%22%3A%22CopyEmbedCode%22%7D&referrer=StreamWebApp&referrerScenario=EmbedDialog.Create"
  },
  {
    id: "learn_003",
    type: "video",
    title: "Key user Instruction",
    module: "System Improvement",
    role: "Key User",
    thumb: "from-blue-500 to-indigo-600",
    views: "0.2k",
    rating: "98%",
    duration: "1:30:59",
    // 👇 加上这行你刚才清洗好的链接
    url: "https://volvogroup.sharepoint.com/sites/unit-uattest/_layouts/15/embed.aspx?UniqueId=554787ae-8f5d-46c7-abfa-869c17d46f64&embed=%7B%22ust%22%3Atrue%2C%22hv%22%3A%22CopyEmbedCode%22%7D&referrer=StreamWebApp&referrerScenario=EmbedDialog.Create"
  },
  { id: 'v1', type: 'video', title: 'SAP APQP 完整操作流程与避坑指南', module: 'Quality/APQP', role: 'SD', duration: '12:45', views: '1.2k', rating: 4.9, thumb: 'from-blue-500 to-indigo-600', isFeatured: true },
  { id: 'v2', type: 'video', title: '如何在 1 分钟内快速创建采购订单 (ME21N)', module: 'Purchasing', role: 'Buyer', duration: '01:15', views: '856', rating: 4.8, thumb: 'from-emerald-400 to-teal-500' },
  { id: 'd1', type: 'doc', title: '2024 供应商主数据 (BP) 维护标准 SOP', module: 'Master Data', role: 'PD', readTime: '5 min', views: '432', rating: 4.5, thumb: 'from-orange-400 to-red-500' },
  { id: 'v3', type: 'video', title: 'MIGO 收货过账：101 与 102 移动类型的区别', module: 'Inventory', role: 'Manager', duration: '05:30', views: '2.1k', rating: 4.9, thumb: 'from-purple-500 to-fuchsia-600' },
  { id: 'd2', type: 'doc', title: '定制化审批流 (PCA) 权限配置手册', module: 'Custom Approval', role: 'Manager', readTime: '8 min', views: '128', rating: 4.2, thumb: 'from-slate-600 to-gray-800' },
  { id: 'v4', type: 'video', title: '计划协议 (ME31L) 批量修改技巧', module: 'Purchasing', role: 'Buyer', duration: '03:20', views: '544', rating: 4.7, thumb: 'from-cyan-400 to-blue-500' },
];

// --- 独立抽出的视频卡片组件 ---
const ContentCard = ({ item }: { item: any }) => (
  <Link href={`/training/${item.id}`} className="group relative flex-none shrink-0 w-72 cursor-pointer snap-start block">
    <div className={`relative aspect-video rounded-2xl bg-gradient-to-br ${item.thumb} shadow-sm overflow-hidden mb-3 transition-transform duration-300 group-hover:scale-[1.03] group-hover:shadow-md`}>
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
        {item.type === 'video' ? <PlayCircle className="w-12 h-12 text-white opacity-90" /> : <BookOpenIcon className="w-10 h-10 text-white opacity-90" />}
      </div>
      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded-md backdrop-blur-md flex items-center gap-1">
        {item.type === 'video' ? <Play className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
        {item.duration || item.readTime}
      </div>
      <div className="absolute top-2 left-2 bg-white/90 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
        {item.module}
      </div>
    </div>
    <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
      {item.title}
    </h3>
    <div className="flex items-center text-xs text-gray-500 gap-3 font-medium">
      <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> {item.views}</span>
      <span className="flex items-center gap-1 text-yellow-500"><Star className="w-3 h-3 fill-current" /> {item.rating}</span>
      <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">{item.type.toUpperCase()}</span>
    </div>
  </Link>
);

// --- 🌟 带有左右滚动按钮的独立泳道组件 ---
// --- 🌟 顶级交互：带有智能边界检测的泳道组件 ---
// --- 🌟 顶级交互：智能边界检测 + 绝对居中 + 动效泳道 ---
function SwimlaneRow({ title, items, reverse = false }: { title: React.ReactNode, items: any[], reverse?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayItems = reverse ? [...items].reverse() : items;

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // 🌟 修复 1：加大容错率到 10px，完美解决苹果/浏览器的弹性滚动(Bounce)导致的判断失效
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
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -800 : 800; 
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, x: 40, scale: 0.95 },
    show: { 
      opacity: 1, 
      x: 0, 
      scale: 1,
      transition: { type: 'spring', stiffness: 260, damping: 20 }
    }
  };

  return (
    <div className="mb-10"> {/* 外层普通容器 */}
      
      {/* 标题放在外面，不再影响内部箭头的绝对定位 */}
      <div className="flex justify-between items-end mb-4 pr-4">
        {title}
      </div>
      
      {/* 🌟 修复 2：把 group 和 relative 放在这里，仅包裹滑块和箭头 */}
      <div className="relative group/lane">
        
        {/* 智能左箭头：top-[89px] 是通过严格的 16:9 数学计算得出的绝对居中点 */}
        <button 
          onClick={() => scroll('left')} 
          className={`absolute left-[-20px] top-[89px] -translate-y-1/2 z-10 bg-white shadow-lg border border-gray-100 p-3 rounded-full transition-all duration-300 hover:scale-110 hover:bg-gray-50 text-gray-800
            ${canScrollLeft ? 'opacity-0 group-hover/lane:opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none scale-90'}
          `}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          ref={scrollRef} 
          onScroll={checkScrollState}
          className="flex gap-6 overflow-x-auto pb-6 pt-2 pl-1 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
        >
          {displayItems.map((item) => (
            <motion.div key={item.id} variants={itemVariants} className="snap-start">
              <ContentCard item={item} />
            </motion.div>
          ))}
          <div className="w-6 flex-none shrink-0 snap-end"></div>
        </motion.div>

        {/* 智能右箭头：同样绝对居中 */}
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

export default function TrainingHub() {
  const [activeTab, setActiveTab] = useState('For You');

  const featuredContent = MOCK_CONTENT.find(c => c.isFeatured);
  const regularContent = MOCK_CONTENT.filter(c => !c.isFeatured);

  return (
    <div className="p-8 pb-24 max-w-[1400px] mx-auto font-sans overflow-x-hidden">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">培训与资源中心</h1>
          <p className="text-gray-500 text-sm">探索为你量身定制的系统指南与最佳实践</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative bg-white rounded-full shadow-sm border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="搜索课程、SOP..." className="w-64 pl-10 pr-4 py-2.5 bg-transparent border-none text-sm outline-none rounded-full" />
          </div>
        </div>
      </div>

      {/* Hero Banner 跳转 */}
      {featuredContent && (
        <div className="relative w-full h-[400px] rounded-3xl overflow-hidden mb-12 shadow-lg group cursor-pointer">
          <div className={`absolute inset-0 bg-gradient-to-r ${featuredContent.thumb} mix-blend-multiply opacity-90`}></div>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-10 w-full md:w-2/3">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">✨ 本周必看 (Featured)</span>
              <span className="text-gray-300 text-sm font-medium flex items-center gap-1"><Clock className="w-4 h-4" /> {featuredContent.duration}</span>
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-4 leading-tight group-hover:underline decoration-blue-500 underline-offset-4">{featuredContent.title}</h2>
            <p className="text-gray-300 text-base mb-6 line-clamp-2">深入了解产品质量先期策划 (APQP) 在 SAP 中的完整闭环操作，专为 Supplier Development 与 Buyer 岗位录制的高阶实战教程。</p>
            <div className="flex gap-4">
              <Link href={`/training/${featuredContent.id}`} className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-gray-100 transition-transform active:scale-95">
                <Play className="w-5 h-5 fill-current" /> 立即播放
              </Link>
              <button className="bg-gray-800/60 backdrop-blur-md text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-gray-700/80 transition-colors border border-gray-600/50">
                <Bookmark className="w-5 h-5" /> 稍后观看
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-8 border-b border-gray-200 pb-4">
        {['For You', '🔥 热门视频', '📄 SOP 手册', '⚙️ 系统更新'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === tab ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900'}`}>{tab}</button>
        ))}
      </div>

      <div className="space-y-10">
        
        {/* 🌟 使用封装好的 SwimlaneRow 组件 */}
        <SwimlaneRow 
          title={
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              基于你的角色 <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-sm font-bold">Buyer</span> 推荐
            </h2>
          }
          items={regularContent} 
        />

        <SwimlaneRow 
          title={<h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">⏱️ 一分钟微学习 (Quick Tips)</h2>}
          items={regularContent} 
          reverse={true} 
        />
        
      </div>
    </div>
  );
}

function BookOpenIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
}