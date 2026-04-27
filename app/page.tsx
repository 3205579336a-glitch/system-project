"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import {
  Search, ExternalLink, Play, Clock, ArrowRight, Star,
  Activity, BookOpen, Sparkles, Loader2, Database, ShieldCheck
} from 'lucide-react';

// --- 模拟 Link 组件，解决环境编译错误 ---
const Link = ({ href, children, className }: { href: string, children: React.ReactNode, className?: string }) => (
  <a href={href} className={className}>{children}</a>
);

export default function WorkspaceHome() {
  const [timeConfig, setTimeConfig] = useState({
    greeting: '你好',
    emoji: '👋',
    theme: 'from-[#003057] to-[#005A9E]',
    halo: 'bg-blue-400'
  });

  const [loading, setLoading] = useState(true);
  const [latestLearning, setLatestLearning] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, videoCount: 0 });
  const [favoriteTCodes] = useState<any[]>([]); // 暂保持静态

  // --- 🌟 辅助函数：根据 ID 生成确定的进度百分比 (让 Demo 看起来更真实) ---
  const getDeterministicProgress = (id: string) => {
    if (!id) return 0;
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    // 生成 15 到 95 之间的百分比
    const progress = 15 + (Math.abs(hash) % 81);
    return progress;
  };

  // --- 1. 初始化 Supabase 并抓取真实数据 ---
  useEffect(() => {
    const initAndFetch = async () => {
      setLoading(true);
      try {
        // 动态加载 Supabase
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

        // 获取最新的一条学习内容
        const { data: latest } = await supabase
          .from('learning_contents')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        // 注入计算出的进度
        if (latest) {
          latest.progress = getDeterministicProgress(latest.id);
        }
        setLatestLearning(latest);

        // 获取统计信息
        const { count } = await supabase
          .from('learning_contents')
          .select('*', { count: 'exact', head: true });

        const { count: vCount } = await supabase
          .from('learning_contents')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'video');

        setStats({ total: count || 0, videoCount: vCount || 0 });

      } catch (err) {
        console.error("Data Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    initAndFetch();

    // 时间配置逻辑
    const hour = new Date().getHours();
    if (hour < 12) {
      setTimeConfig({ greeting: '早上好', emoji: '🌅', theme: 'from-orange-500 to-amber-600', halo: 'bg-yellow-300' });
    } else if (hour < 18) {
      setTimeConfig({ greeting: '下午好', emoji: '☀️', theme: 'from-[#003057] to-[#005A9E]', halo: 'bg-blue-400' });
    } else {
      setTimeConfig({ greeting: '晚上好', emoji: '🌙', theme: 'from-indigo-900 to-slate-800', halo: 'bg-purple-500' });
    }
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="p-8 pb-24 max-w-[1400px] mx-auto font-sans bg-[#FBFBFE] min-h-screen text-slate-900">

      {/* 顶部标题区 */}
      <div className="mb-10 flex items-center justify-between">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <h1 className="text-4xl font-black text-slate-900 mb-2 flex items-center gap-4 tracking-tighter">
            {timeConfig.greeting}，Demo User
            <motion.span
              animate={{ rotate: [0, 20, -10, 20, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
              className="inline-block"
            >
              {timeConfig.emoji}
            </motion.span>
          </h1>
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-slate-400 text-sm font-medium tracking-tight uppercase">
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })} · 系统已就绪
            </p>
          </div>
        </motion.div>
      </div>

      {/* 核心 Bento Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6 auto-rows-[180px]"
      >

        {/* 1. 超级搜索卡片 (占 8 列，高度 2 行) */}
        <motion.div variants={cardVariants} className={`md:col-span-6 lg:col-span-8 row-span-2 relative overflow-hidden rounded-[48px] bg-gradient-to-br ${timeConfig.theme} shadow-2xl group`}>
          <div className={`absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] ${timeConfig.halo} rounded-full mix-blend-overlay filter blur-[100px] opacity-40 animate-pulse`}></div>

          <div className="relative h-full p-10 md:p-12 flex flex-col justify-between z-10 text-white">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full mb-6 shadow-xl">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Enterprise Workspace</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black mb-4 leading-[1.1] tracking-tighter">
                连接业务数据，<br />驱动智慧决策。
              </h2>
            </div>

            <div className="relative max-w-xl group/search">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-blue-300/50 group-focus-within/search:text-blue-400 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="搜索 T-code、业务模块或 SOP 文档..."
                className="w-full pl-16 pr-6 py-5 bg-white/10 backdrop-blur-2xl border border-white/10 text-white text-lg outline-none rounded-3xl shadow-2xl focus:bg-white focus:text-slate-900 transition-all placeholder-white/40 font-bold"
              />
              <div className="absolute inset-y-0 right-3 flex items-center">
                <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black opacity-40">CMD K</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 2. 常用事务代码 (占 4 列，高度 2 行) */}
        <motion.div variants={cardVariants} className="md:col-span-6 lg:col-span-4 row-span-2 bg-white rounded-[40px] p-8 shadow-sm border border-slate-100 flex flex-col hover:shadow-xl transition-all h-full overflow-hidden relative border-solid">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h3 className="font-black text-slate-900 flex items-center gap-3 text-lg tracking-tight">
              <div className="p-2 bg-amber-50 rounded-xl"><Star className="w-5 h-5 text-amber-500 fill-amber-500" /></div>
              常用事务代码
            </h3>
            <Link href="/t-codes" className="p-2 hover:bg-slate-50 rounded-full transition-colors"><ArrowRight className="w-5 h-5 text-slate-300" /></Link>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
            {favoriteTCodes.length > 0 ? (
              <div className="space-y-3">
                {favoriteTCodes.map(t => (
                  <div key={t.code} className="group flex items-center justify-between p-4 rounded-3xl hover:bg-blue-50/50 border border-transparent hover:border-blue-100 transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs shadow-inner`}>
                        {t.code.substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm font-mono tracking-tight">{t.code}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{t.desc}</p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-200 group-hover:text-blue-500 transition-colors" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-100 rounded-[32px] bg-slate-50/30">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                  <Star className="w-6 h-6 text-slate-200" />
                </div>
                <p className="text-sm font-black text-slate-800 mb-1 uppercase tracking-widest">No Favorites Yet</p>
                <p className="text-[11px] text-slate-400 font-medium px-4 mb-6">点击系统中的星号，将常用工具固定至此处。</p>
                <Link href="/training" className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-slate-200">
                  发现更多工具
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* 3. 动态接入：继续观看 (接入计算出的“真实”进度) */}
        <motion.div variants={cardVariants} className="md:col-span-3 lg:col-span-6 row-span-1 bg-white rounded-[40px] p-2 shadow-sm border border-slate-100 relative overflow-hidden group">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center bg-slate-50 animate-pulse rounded-[36px]">
              <Loader2 className="w-6 h-6 animate-spin text-slate-200" />
            </div>
          ) : latestLearning ? (
            <>
              <Link href={`/training/${latestLearning.id}`} className="absolute inset-0 z-10">
                {/* 添加一段仅屏幕阅读器可见的文本，既满足 TS 的 children 要求，又提升无障碍体验 */}
                <span className="sr-only">直达培训详情</span>
              </Link>
              <div className="flex h-full">
                <div className="w-48 h-full rounded-[32px] relative overflow-hidden shrink-0 border border-slate-50">
                  {latestLearning.thumbnail_url ? (
                    <img src={latestLearning.thumbnail_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Thumb" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Play className="w-10 h-10 text-white opacity-40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-full shadow-2xl border border-white/20">
                      <Play className="w-6 h-6 text-white fill-current" />
                    </div>
                  </div>
                </div>
                <div className="p-6 flex flex-col justify-between flex-1 min-w-0">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Latest Insight</p>
                    </div>
                    <h3 className="font-black text-slate-900 text-xl line-clamp-1 group-hover:text-blue-600 transition-colors tracking-tight">
                      {latestLearning.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{latestLearning.module} · {latestLearning.role}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      {/* 🌟 使用计算出的真实进度 */}
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${latestLearning.progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-blue-600 h-full rounded-full"
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{latestLearning.progress}% Complete</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full w-full bg-slate-50 rounded-[36px] italic text-slate-300 font-bold uppercase text-xs tracking-widest">
              No Learning Path Found
            </div>
          )}
        </motion.div>

        {/* 4. 实时统计卡片 (占 3 列，高度 1 行) */}
        <motion.div variants={cardVariants} className="md:col-span-3 lg:col-span-3 row-span-1 bg-white rounded-[40px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-lg transition-all border-solid">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div className="px-3 py-1 bg-green-50 rounded-full flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
              <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Live Sync</span>
            </div>
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-3xl mb-1 tracking-tighter">{stats.total}</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">解析入库文档总量</p>
          </div>
        </motion.div>

        {/* 5. 快捷动作/动态版本 (占 3 列，高度 1 行) */}
        <motion.div variants={cardVariants} className="md:col-span-3 lg:col-span-3 row-span-1 bg-slate-900 rounded-[40px] p-8 shadow-2xl flex flex-col justify-between group cursor-pointer hover:scale-[1.02] transition-transform">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 border border-white/10">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <Link href="/analysis" className="text-white/20 hover:text-white transition-colors"><ArrowRight className="w-6 h-6" /></Link>
          </div>
          <div>
            <h3 className="font-black text-white text-lg mb-1 tracking-tight">AI 知识工场</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">前往解析 200+ 新素材</p>
          </div>
        </motion.div>

      </motion.div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
}